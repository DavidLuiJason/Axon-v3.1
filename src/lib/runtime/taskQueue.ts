/**
 * AXON Bounded Priority Task Queue
 * 
 * Manages task queueing, prioritization, deduplication, and bounds enforcement
 * to prevent unbounded memory growth and duplicate workloads.
 */

import { TaskConfig, TaskHandle, TaskPriority, TaskStatus, DeduplicationPolicy } from './types';

export interface InternalTaskEntry<TInput = unknown, TOutput = unknown> {
  handle: TaskHandle<TOutput>;
  config: TaskConfig<TInput, TOutput>;
  abortController: AbortController;
  resolve: (value: TOutput) => void;
  reject: (reason: any) => void;
  enqueuedAt: number;
}

export class TaskQueue {
  private queue: Array<InternalTaskEntry<any, any>> = [];
  private deduplicationMap = new Map<string, InternalTaskEntry<any, any>>();
  private maxCapacity: number;

  constructor(maxCapacity: number = 500) {
    this.maxCapacity = maxCapacity;
  }

  get size(): number {
    return this.queue.length;
  }

  isFull(): boolean {
    return this.queue.length >= this.maxCapacity;
  }

  /**
   * Find an active or pending task by its deduplication key
   */
  findByDeduplicationKey(key: string): InternalTaskEntry<any, any> | undefined {
    return this.deduplicationMap.get(key);
  }

  /**
   * Register or look up deduplication
   */
  handleDeduplication<TInput, TOutput>(
    key: string,
    policy: DeduplicationPolicy,
    newConfig: TaskConfig<TInput, TOutput>
  ): { existing?: InternalTaskEntry<any, any>; shouldReject?: boolean } {
    const existing = this.deduplicationMap.get(key);
    if (!existing) {
      return {};
    }

    // If existing task is already completed/failed/cancelled, it's safe to overwrite
    if (['completed', 'failed', 'cancelled'].includes(existing.handle.status)) {
      this.deduplicationMap.delete(key);
      return {};
    }

    if (policy === 'reuse') {
      return { existing };
    }

    if (policy === 'reject') {
      return { shouldReject: true };
    }

    if (policy === 'replace') {
      // Cancel existing if it is still queued
      if (existing.handle.status === 'queued') {
        this.remove(existing.handle.id);
        existing.handle.cancel('Replaced by newer task with identical deduplication key');
      }
      return {};
    }

    return { existing };
  }

  /**
   * Enqueue a new task into the priority queue.
   * Higher priority comes first; within same priority, FIFO order is preserved.
   */
  enqueue(entry: InternalTaskEntry<any, any>): void {
    if (this.isFull()) {
      throw new Error(
        `[TaskQueue] Bounded capacity limit reached (${this.maxCapacity}). Workload rejected to prevent memory exhaustion.`
      );
    }

    // Register deduplication key if specified
    if (entry.config.deduplicationKey) {
      this.deduplicationMap.set(entry.config.deduplicationKey, entry);
    }

    // Binary search / insertion sort for priority order
    // Priorities: higher number = higher priority
    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      const current = this.queue[i];
      if (entry.config.priority > current.config.priority) {
        insertIndex = i;
        break;
      }
    }

    this.queue.splice(insertIndex, 0, entry);
  }

  /**
   * Dequeue the highest priority task ready for execution.
   * Optionally filters or respects interaction constraints.
   */
  dequeue(filter?: (entry: InternalTaskEntry<any, any>) => boolean): InternalTaskEntry<any, any> | undefined {
    if (this.queue.length === 0) return undefined;

    if (!filter) {
      return this.queue.shift();
    }

    const index = this.queue.findIndex(filter);
    if (index === -1) return undefined;

    const [item] = this.queue.splice(index, 1);
    return item;
  }

  /**
   * Remove a specific task by ID (e.g. on cancellation before execution)
   */
  remove(taskId: string): InternalTaskEntry<any, any> | undefined {
    const index = this.queue.findIndex((e) => e.handle.id === taskId);
    if (index === -1) return undefined;

    const [removed] = this.queue.splice(index, 1);
    if (removed.config.deduplicationKey) {
      this.deduplicationMap.delete(removed.config.deduplicationKey);
    }
    return removed;
  }

  /**
   * Remove deduplication reference when a task terminates
   */
  cleanupDeduplication(key?: string): void {
    if (key) {
      this.deduplicationMap.delete(key);
    }
  }

  /**
   * Get all currently queued tasks
   */
  getQueuedEntries(): ReadonlyArray<InternalTaskEntry<any, any>> {
    return this.queue;
  }

  clear(): InternalTaskEntry<any, any>[] {
    const items = [...this.queue];
    this.queue = [];
    this.deduplicationMap.clear();
    return items;
  }
}
