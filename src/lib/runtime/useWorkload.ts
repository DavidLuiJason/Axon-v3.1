/**
 * AXON Workload Manager — React Integration Hooks
 * 
 * Provides component-lifecycle-aware task submission, automatic cancellation
 * on unmount, and reactive diagnostic observability for future AXON systems.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { workloadManager } from './workloadManager';
import {
  TaskConfig,
  TaskHandle,
  WorkloadDiagnostics,
  WorkloadEvent,
} from './types';

/**
 * Hook for submitting tasks that automatically cancel if the calling
 * component is unmounted while the task is queued or in flight.
 */
export function useWorkloadTask() {
  const activeTaskIdsRef = useRef<Set<string>>(new Set());

  // Cancel all pending tasks submitted by this component when it unmounts
  useEffect(() => {
    const taskIds = activeTaskIdsRef.current;
    return () => {
      for (const id of taskIds) {
        workloadManager.cancelTask(id, 'Component unmounted');
      }
      taskIds.clear();
    };
  }, []);

  const submit = useCallback(
    <TInput = unknown, TOutput = unknown>(
      config: TaskConfig<TInput, TOutput>
    ): TaskHandle<TOutput> => {
      const handle = workloadManager.submit(config);
      activeTaskIdsRef.current.add(handle.id);

      handle.promise.finally(() => {
        activeTaskIdsRef.current.delete(handle.id);
      });

      return handle;
    },
    []
  );

  const run = useCallback(
    <TInput = unknown, TOutput = unknown>(
      config: TaskConfig<TInput, TOutput>
    ): Promise<TOutput> => {
      const handle = submit(config);
      return handle.promise;
    },
    [submit]
  );

  const cancel = useCallback((taskId: string, reason?: string) => {
    activeTaskIdsRef.current.delete(taskId);
    return workloadManager.cancelTask(taskId, reason);
  }, []);

  return {
    submit,
    run,
    cancel,
  };
}

/**
 * Reactive hook for observing central workload diagnostics and state.
 */
export function useWorkloadDiagnostics(): WorkloadDiagnostics {
  const [diagnostics, setDiagnostics] = useState<WorkloadDiagnostics>(() =>
    workloadManager.getDiagnostics()
  );

  useEffect(() => {
    const update = () => {
      setDiagnostics(workloadManager.getDiagnostics());
    };

    const unsubscribe = workloadManager.subscribe((_event: WorkloadEvent) => {
      update();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return diagnostics;
}
