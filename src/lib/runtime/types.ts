/**
 * AXON Runtime & Processing System — Type Definitions
 * 
 * Centralized, reusable types for workload management, task prioritization,
 * dynamic concurrency control, task lifecycles, and failure diagnostics.
 */

export enum TaskPriority {
  /** High-priority interactive operations directly needed for user frame responsiveness */
  INTERACTIVE = 100,
  /** User-requested foreground operations (e.g. user clicked run, search, evaluate) */
  USER_FOREGROUND = 75,
  /** Normal asynchronous background processing (e.g. caching, parsing, preprocessing) */
  NORMAL_BACKGROUND = 50,
  /** Low-priority housekeeping, diagnostics, cleanup, and indexing */
  MAINTENANCE = 25,
}

export type TaskStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused';

export type DeduplicationPolicy =
  | 'reuse'   // Return existing task's handle / promise without re-enqueueing
  | 'reject'  // Reject submission with an error if identical key is pending/running
  | 'replace'; // Cancel pending duplicate and queue new one

export interface TaskExecutionContext {
  taskId: string;
  taskType: string;
  priority: TaskPriority;
  signal: AbortSignal;
  isCancelled: () => boolean;
  /**
   * Cooperative yielding to allow browser main thread to process DOM events,
   * layout, animations, and input without dropping frames.
   */
  yieldToMain: (minIntervalMs?: number) => Promise<void>;
  /** Report progress fraction (0.0 to 1.0) and optional diagnostic message */
  reportProgress: (fraction: number, message?: string) => void;
  /** Set task-specific metadata or intermediate diagnostic checkpoints */
  setMeta: (key: string, value: unknown) => void;
  /** Read current runtime snapshot */
  getRuntimeState: () => RuntimeStateSnapshot;
}

export interface TaskConfig<TInput = unknown, TOutput = unknown> {
  /** Optional custom ID; auto-generated if omitted */
  id?: string;
  /** System identifier designating the category of work (e.g., 'data_indexing', 'computation') */
  type: string;
  /** Human-readable task name */
  name?: string;
  /** Priority level for scheduling */
  priority: TaskPriority;
  /** Optional input payload passed to execution context */
  input?: TInput;
  /** The unit of asynchronous work to execute */
  execute: (ctx: TaskExecutionContext) => Promise<TOutput>;
  /** Maximum execution time before task is forcefully aborted via AbortSignal */
  timeoutMs?: number;
  /** Clean-up callback executed on task completion, failure, or cancellation */
  cleanup?: () => Promise<void> | void;
  /** Deduplication key to prevent concurrent redundant workloads */
  deduplicationKey?: string;
  /** How to handle deduplication collisions (default: 'reuse') */
  deduplicationPolicy?: DeduplicationPolicy;
  /**
   * Whether to retain full output payload in the manager's history buffer.
   * Default false to avoid unbounded memory retention.
   */
  retainResult?: boolean;
  /** Maximum retry attempts for transient failures (default: 0) */
  maxRetries?: number;
  /** Optional metadata tags */
  meta?: Record<string, unknown>;
}

export interface TaskHandle<TOutput = unknown> {
  id: string;
  type: string;
  name: string;
  priority: TaskPriority;
  status: TaskStatus;
  progress: number;
  progressMessage?: string;
  result?: TOutput;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  retriesCount: number;
  promise: Promise<TOutput>;
  cancel: (reason?: string) => boolean;
}

export interface RuntimeStateSnapshot {
  activeWorkers: number;
  queuedTasksCount: number;
  completedTasksCount: number;
  failedTasksCount: number;
  cancelledTasksCount: number;
  currentConcurrencyLimit: number;
  baseConcurrencyLimit: number;
  isUserInteracting: boolean;
  isAppVisible: boolean;
  systemPressure: 'nominal' | 'elevated' | 'throttled';
}

export interface WorkloadDiagnostics extends RuntimeStateSnapshot {
  timestamp: number;
  uptimeMs: number;
  totalTasksProcessed: number;
  recentTasks: Array<{
    id: string;
    type: string;
    name: string;
    priority: TaskPriority;
    status: TaskStatus;
    durationMs?: number;
    error?: string;
  }>;
}

export type WorkloadEvent =
  | { type: 'task_queued'; task: TaskHandle<any> }
  | { type: 'task_started'; task: TaskHandle<any> }
  | { type: 'task_progress'; task: TaskHandle<any>; progress: number; message?: string }
  | { type: 'task_completed'; task: TaskHandle<any> }
  | { type: 'task_failed'; task: TaskHandle<any>; error: { message: string } }
  | { type: 'task_cancelled'; task: TaskHandle<any>; reason?: string }
  | { type: 'concurrency_changed'; currentLimit: number; reason: string }
  | { type: 'pressure_changed'; pressure: 'nominal' | 'elevated' | 'throttled' };

export type WorkloadEventListener = (event: WorkloadEvent) => void;
