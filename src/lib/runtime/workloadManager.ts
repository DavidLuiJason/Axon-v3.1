/**
 * AXON Central Workload Manager
 * 
 * Foundational runtime system providing centralized task queueing, priority scheduling,
 * dynamic concurrency control, frame-safe execution, task isolation, and lifecycle handling.
 */

import {
  TaskConfig,
  TaskHandle,
  TaskPriority,
  TaskStatus,
  TaskExecutionContext,
  WorkloadDiagnostics,
  WorkloadEvent,
  WorkloadEventListener,
  RuntimeStateSnapshot,
} from './types';
import { TaskQueue, InternalTaskEntry } from './taskQueue';
import { ResourceMonitor, ResourceState } from './resourceMonitor';
import { yieldToMain, TimeSlicer } from './timeSlicer';

export class WorkloadManager {
  private queue: TaskQueue;
  private resourceMonitor: ResourceMonitor;
  private activeWorkers = new Map<string, InternalTaskEntry<any, any>>();
  private recentTasks: Array<TaskHandle<any>> = [];
  private readonly maxRecentHistory = 50;

  private totalCompleted = 0;
  private totalFailed = 0;
  private totalCancelled = 0;
  private startTime = Date.now();

  private listeners = new Set<WorkloadEventListener>();
  private unsubscribeResourceMonitor: () => void;
  private isDestroyed = false;

  constructor(maxQueueCapacity: number = 500) {
    this.queue = new TaskQueue(maxQueueCapacity);
    this.resourceMonitor = new ResourceMonitor();

    // Listen to environmental and lifecycle shifts
    this.unsubscribeResourceMonitor = this.resourceMonitor.subscribe((state) => {
      this.handleResourceStateChange(state);
    });

    // Attach unobtrusive diagnostic handle in browser environment for testing & monitoring
    if (typeof window !== 'undefined') {
      (window as any).__AXON_WORKLOAD_MANAGER__ = this;
      (window as any).__AXON_RUNTIME__ = {
        getDiagnostics: () => this.getDiagnostics(),
        submit: (cfg: any) => this.submit(cfg),
        run: (cfg: any) => this.run(cfg),
        cancel: (id: string, reason?: string) => this.cancelTask(id, reason),
      };
    }
  }

  /**
   * Submit an asynchronous task to the central workload manager.
   * Returns a TaskHandle containing an observable promise, status, and cancellation method.
   */
  submit<TInput = unknown, TOutput = unknown>(
    config: TaskConfig<TInput, TOutput>
  ): TaskHandle<TOutput> {
    if (this.isDestroyed) {
      throw new Error('[WorkloadManager] Manager has been destroyed; cannot accept new tasks.');
    }

    const taskId = config.id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const taskName = config.name || `${config.type}_${taskId.slice(-4)}`;
    const priority = config.priority ?? TaskPriority.NORMAL_BACKGROUND;
    const policy = config.deduplicationPolicy || 'reuse';

    // 1. Deduplication check
    if (config.deduplicationKey) {
      const { existing, shouldReject } = this.queue.handleDeduplication(
        config.deduplicationKey,
        policy,
        config
      );

      if (shouldReject) {
        throw new Error(
          `[WorkloadManager] Task rejected: Duplicate active task with key "${config.deduplicationKey}".`
        );
      }

      if (existing) {
        return existing.handle as TaskHandle<TOutput>;
      }
    }

    // 2. Prepare deferred promise and abort controller
    let resolvePromise!: (val: TOutput) => void;
    let rejectPromise!: (reason: any) => void;

    const promise = new Promise<TOutput>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    const abortController = new AbortController();

    // 3. Assemble task handle
    const handle: TaskHandle<TOutput> = {
      id: taskId,
      type: config.type,
      name: taskName,
      priority,
      status: 'queued',
      progress: 0,
      createdAt: Date.now(),
      retriesCount: 0,
      promise,
      cancel: (reason?: string) => this.cancelTask(taskId, reason),
    };

    const entry: InternalTaskEntry<TInput, TOutput> = {
      handle,
      config,
      abortController,
      resolve: resolvePromise,
      reject: rejectPromise,
      enqueuedAt: Date.now(),
    };

    // 4. Enqueue with priority
    this.queue.enqueue(entry);
    this.emitEvent({ type: 'task_queued', task: handle });

    // 5. Schedule queue processing
    this.pumpQueue();

    return handle;
  }

  /**
   * Convenience wrapper: Submits a task and awaits its completed result directly.
   */
  async run<TInput = unknown, TOutput = unknown>(
    config: TaskConfig<TInput, TOutput>
  ): Promise<TOutput> {
    const handle = this.submit(config);
    return handle.promise;
  }

  /**
   * Cancel an active or queued task by ID.
   */
  cancelTask(taskId: string, reason: string = 'User or system cancelled'): boolean {
    // Check if it is queued
    const queued = this.queue.remove(taskId);
    if (queued) {
      queued.handle.status = 'cancelled';
      queued.handle.completedAt = Date.now();
      queued.handle.durationMs = queued.handle.completedAt - queued.handle.createdAt;
      queued.abortController.abort(reason);
      queued.reject(new Error(`Task cancelled: ${reason}`));

      this.totalCancelled++;
      this.recordRecentTask(queued.handle);
      this.emitEvent({ type: 'task_cancelled', task: queued.handle, reason });
      this.queue.cleanupDeduplication(queued.config.deduplicationKey);
      return true;
    }

    // Check if it is currently running
    const running = this.activeWorkers.get(taskId);
    if (running) {
      running.handle.status = 'cancelled';
      running.abortController.abort(reason);
      // Execution loop in executeWorker will finalize cleanup and history recording
      return true;
    }

    return false;
  }

  /**
   * Cancel all tasks matching an optional filter
   */
  cancelAll(filter?: { type?: string; priority?: TaskPriority }): number {
    let count = 0;

    // Cancel queued tasks
    const queuedItems = [...this.queue.getQueuedEntries()];
    for (const item of queuedItems) {
      if (!filter || (filter.type && item.config.type === filter.type) || (filter.priority && item.config.priority === filter.priority)) {
        if (this.cancelTask(item.handle.id, 'Batch cancelled')) {
          count++;
        }
      }
    }

    // Cancel active workers
    for (const [id, item] of this.activeWorkers) {
      if (!filter || (filter.type && item.config.type === filter.type) || (filter.priority && item.config.priority === filter.priority)) {
        if (this.cancelTask(id, 'Batch cancelled')) {
          count++;
        }
      }
    }

    return count;
  }

  /**
   * Main scheduler pump loop.
   * Evaluates active concurrency limit, priority ordering, and dispatches workers.
   */
  private pumpQueue(): void {
    if (this.isDestroyed) return;

    const limit = this.resourceMonitor.getCurrentConcurrencyLimit();
    const isUserInteracting = this.resourceMonitor.getState().isUserInteracting;

    while (this.activeWorkers.size < limit && this.queue.size > 0) {
      // If user is actively interacting and we already have 1 worker running, hold low-priority tasks
      let nextEntry: InternalTaskEntry<any, any> | undefined;

      if (isUserInteracting && this.activeWorkers.size >= 1) {
        // Only allow INTERACTIVE or USER_FOREGROUND tasks during user input pressure
        nextEntry = this.queue.dequeue((e) => e.config.priority >= TaskPriority.USER_FOREGROUND);
        if (!nextEntry) {
          // No high-priority tasks waiting; let the active worker finish before taking background work
          break;
        }
      } else {
        nextEntry = this.queue.dequeue();
      }

      if (!nextEntry) break;

      this.dispatchWorker(nextEntry);
    }
  }

  /**
   * Execute an individual task worker with full failure isolation, timeout guard,
   * progress tracking, and cooperative main thread yielding.
   */
  private async dispatchWorker(entry: InternalTaskEntry<any, any>): Promise<void> {
    const { handle, config, abortController, resolve, reject } = entry;
    const taskId = handle.id;

    this.activeWorkers.set(taskId, entry);

    handle.status = 'running';
    handle.startedAt = Date.now();
    this.emitEvent({ type: 'task_started', task: handle });

    // Setup timeout guard if requested
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
    if (config.timeoutMs && config.timeoutMs > 0) {
      timeoutTimer = setTimeout(() => {
        abortController.abort(
          new Error(`Task timeout exceeded after ${config.timeoutMs}ms`)
        );
      }, config.timeoutMs);
    }

    // Build Execution Context
    const context: TaskExecutionContext = {
      taskId,
      taskType: config.type,
      priority: config.priority,
      signal: abortController.signal,
      isCancelled: () => abortController.signal.aborted,
      yieldToMain: async () => {
        await yieldToMain();
      },
      reportProgress: (fraction: number, message?: string) => {
        const clamped = Math.max(0, Math.min(1, fraction));
        handle.progress = clamped;
        if (message !== undefined) {
          handle.progressMessage = message;
        }
        this.emitEvent({
          type: 'task_progress',
          task: handle,
          progress: clamped,
          message,
        });
      },
      setMeta: (key: string, value: unknown) => {
        if (!handle.result) {
          (handle as any).meta = (handle as any).meta || {};
          (handle as any).meta[key] = value;
        }
      },
      getRuntimeState: () => this.getRuntimeState(),
    };

    let result: any = undefined;
    let taskError: any = null;

    try {
      // Execute the task isolated inside try/catch
      result = await config.execute(context);

      if (abortController.signal.aborted) {
        throw new Error(abortController.signal.reason || 'Task aborted during execution');
      }

      // Success
      handle.status = 'completed';
      handle.progress = 1;
      handle.completedAt = Date.now();
      handle.durationMs = handle.completedAt - (handle.startedAt || handle.createdAt);
      if (config.retainResult) {
        handle.result = result;
      }

      this.totalCompleted++;
      this.emitEvent({ type: 'task_completed', task: handle });
      resolve(result);
    } catch (err: any) {
      taskError = err;

      if (abortController.signal.aborted || (handle.status as TaskStatus) === 'cancelled') {
        handle.status = 'cancelled';
        handle.completedAt = Date.now();
        handle.durationMs = handle.completedAt - (handle.startedAt || handle.createdAt);

        this.totalCancelled++;
        this.emitEvent({
          type: 'task_cancelled',
          task: handle,
          reason: err?.message || 'Cancelled',
        });
        reject(err);
      } else {
        // Failure isolation: Task fails cleanly without bringing down AXON
        handle.status = 'failed';
        handle.completedAt = Date.now();
        handle.durationMs = handle.completedAt - (handle.startedAt || handle.createdAt);
        handle.error = {
          message: err?.message || String(err),
          stack: err?.stack,
          code: err?.code || 'TASK_EXECUTION_ERROR',
        };

        this.totalFailed++;
        this.emitEvent({
          type: 'task_failed',
          task: handle,
          error: { message: handle.error.message },
        });
        reject(err);
      }
    } finally {
      // 1. Clear timeout guard
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }

      // 2. Invoke task cleanup safely
      if (typeof config.cleanup === 'function') {
        try {
          await config.cleanup();
        } catch (cleanupErr) {
          console.warn(`[WorkloadManager] Task "${taskId}" cleanup error:`, cleanupErr);
        }
      }

      // 3. Remove from deduplication index
      this.queue.cleanupDeduplication(config.deduplicationKey);

      // 4. Release active worker slot
      this.activeWorkers.delete(taskId);

      // 5. Record to bounded recent history
      this.recordRecentTask(handle);

      // 6. Pump the queue for next available work
      this.pumpQueue();
    }
  }

  /**
   * Handle changes in environmental pressure (visibility, user gestures)
   */
  private handleResourceStateChange(state: ResourceState): void {
    this.emitEvent({
      type: 'concurrency_changed',
      currentLimit: state.currentConcurrencyLimit,
      reason: state.pressureLevel,
    });
    this.emitEvent({
      type: 'pressure_changed',
      pressure: state.pressureLevel,
    });

    // If concurrency budget expanded, pump queue
    this.pumpQueue();
  }

  /**
   * Store lightweight task descriptor in bounded ring buffer for diagnostics
   */
  private recordRecentTask(handle: TaskHandle<any>): void {
    this.recentTasks.unshift(handle);
    if (this.recentTasks.length > this.maxRecentHistory) {
      this.recentTasks.pop();
    }
  }

  /**
   * Read-only runtime snapshot
   */
  getRuntimeState(): RuntimeStateSnapshot {
    const resourceState = this.resourceMonitor.getState();
    return {
      activeWorkers: this.activeWorkers.size,
      queuedTasksCount: this.queue.size,
      completedTasksCount: this.totalCompleted,
      failedTasksCount: this.totalFailed,
      cancelledTasksCount: this.totalCancelled,
      currentConcurrencyLimit: resourceState.currentConcurrencyLimit,
      baseConcurrencyLimit: resourceState.baseConcurrency,
      isUserInteracting: resourceState.isUserInteracting,
      isAppVisible: resourceState.isAppVisible,
      systemPressure: resourceState.pressureLevel,
    };
  }

  /**
   * Diagnostic summary for observability and testing
   */
  getDiagnostics(): WorkloadDiagnostics {
    const snapshot = this.getRuntimeState();
    return {
      ...snapshot,
      timestamp: Date.now(),
      uptimeMs: Date.now() - this.startTime,
      totalTasksProcessed: this.totalCompleted + this.totalFailed + this.totalCancelled,
      recentTasks: this.recentTasks.map((t) => ({
        id: t.id,
        type: t.type,
        name: t.name,
        priority: t.priority,
        status: t.status,
        durationMs: t.durationMs,
        error: t.error?.message,
      })),
    };
  }

  /**
   * Get an active or queued task by ID
   */
  getTask(taskId: string): TaskHandle<any> | undefined {
    const running = this.activeWorkers.get(taskId);
    if (running) return running.handle;

    const queued = this.queue.getQueuedEntries().find((e) => e.handle.id === taskId);
    if (queued) return queued.handle;

    return this.recentTasks.find((t) => t.id === taskId);
  }

  /**
   * Subscribe to workload lifecycle events
   */
  subscribe(listener: WorkloadEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitEvent(event: WorkloadEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[WorkloadManager] Error in event listener:', err);
      }
    }
  }

  getResourceMonitor(): ResourceMonitor {
    return this.resourceMonitor;
  }

  clearHistory(): void {
    this.recentTasks = [];
  }

  /**
   * Gracefully shut down the workload manager
   */
  destroy(): void {
    this.isDestroyed = true;
    this.cancelAll();
    this.unsubscribeResourceMonitor();
    this.resourceMonitor.destroy();
    this.listeners.clear();
    if (typeof window !== 'undefined') {
      delete (window as any).__AXON_WORKLOAD_MANAGER__;
      delete (window as any).__AXON_RUNTIME__;
    }
  }
}

/**
 * Singleton instance of the AXON Central Workload Manager
 */
export const workloadManager = new WorkloadManager();
