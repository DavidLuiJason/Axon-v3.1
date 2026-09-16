/**
 * AXON Unified Media Foundation — Shared Undo/Redo History Stack
 * Generic, battle-tested history stack and React hook for any tool built on this foundation.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { HistoryEntry, HistoryOptions, HistorySnapshot } from './types';

export class MediaHistoryStack<T> {
  private pastEntries: HistoryEntry<T>[] = [];
  private currentEntry: HistoryEntry<T>;
  private futureEntries: HistoryEntry<T>[] = [];
  private maxDepth: number;
  private listeners: Set<(snapshot: HistorySnapshot<T>) => void> = new Set();

  constructor(initialState: T, options?: HistoryOptions) {
    this.maxDepth = options?.maxDepth ?? 50;
    this.currentEntry = {
      state: this.cloneState(initialState),
      timestamp: Date.now(),
      actionDescription: 'Initial state',
    };
  }

  private cloneState(state: T): T {
    if (state === null || typeof state !== 'object') {
      return state;
    }
    // Deep clone state to ensure immutability in the history stack
    try {
      if (typeof structuredClone === 'function') {
        return structuredClone(state);
      }
      return JSON.parse(JSON.stringify(state));
    } catch {
      return state;
    }
  }

  private notify() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('[MediaHistoryStack] Listener error:', err);
      }
    });
  }

  public get present(): T {
    return this.currentEntry.state;
  }

  public get past(): HistoryEntry<T>[] {
    return [...this.pastEntries];
  }

  public get future(): HistoryEntry<T>[] {
    return [...this.futureEntries];
  }

  public get canUndo(): boolean {
    return this.pastEntries.length > 0;
  }

  public get canRedo(): boolean {
    return this.futureEntries.length > 0;
  }

  public push(newState: T, actionDescription?: string): void {
    const cloned = this.cloneState(newState);

    this.pastEntries.push({
      state: this.currentEntry.state,
      timestamp: this.currentEntry.timestamp,
      actionDescription: this.currentEntry.actionDescription,
    });

    if (this.pastEntries.length > this.maxDepth) {
      this.pastEntries.shift();
    }

    this.currentEntry = {
      state: cloned,
      timestamp: Date.now(),
      actionDescription: actionDescription || 'Updated state',
    };

    // Any new action clears future redo history
    this.futureEntries = [];
    this.notify();
  }

  public undo(): T | null {
    if (!this.canUndo) return null;

    const previous = this.pastEntries.pop()!;
    this.futureEntries.unshift(this.currentEntry);

    this.currentEntry = previous;
    this.notify();
    return this.currentEntry.state;
  }

  public redo(): T | null {
    if (!this.canRedo) return null;

    const next = this.futureEntries.shift()!;
    this.pastEntries.push(this.currentEntry);

    this.currentEntry = next;
    this.notify();
    return this.currentEntry.state;
  }

  public jumpTo(pastIndex: number): T | null {
    if (pastIndex < 0 || pastIndex >= this.pastEntries.length) return null;

    const target = this.pastEntries[pastIndex];
    const movedToFuture = this.pastEntries.slice(pastIndex + 1);
    this.pastEntries = this.pastEntries.slice(0, pastIndex);

    this.futureEntries = [...movedToFuture, this.currentEntry, ...this.futureEntries];
    this.currentEntry = target;

    this.notify();
    return this.currentEntry.state;
  }

  public clear(newInitialState?: T): void {
    this.pastEntries = [];
    this.futureEntries = [];
    const baseState = newInitialState !== undefined ? newInitialState : this.currentEntry.state;
    this.currentEntry = {
      state: this.cloneState(baseState),
      timestamp: Date.now(),
      actionDescription: 'History cleared',
    };
    this.notify();
  }

  public getSnapshot(): HistorySnapshot<T> {
    return {
      past: [...this.pastEntries],
      present: this.currentEntry.state,
      future: [...this.futureEntries],
      canUndo: this.canUndo,
      canRedo: this.canRedo,
    };
  }

  public subscribe(listener: (snapshot: HistorySnapshot<T>) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

/**
 * React hook for shared undo/redo state management in media tools.
 */
export function useMediaHistory<T>(initialState: T, options?: HistoryOptions) {
  const stackRef = useRef<MediaHistoryStack<T> | null>(null);
  if (!stackRef.current) {
    stackRef.current = new MediaHistoryStack<T>(initialState, options);
  }

  const [snapshot, setSnapshot] = useState<HistorySnapshot<T>>(() =>
    stackRef.current!.getSnapshot()
  );

  useEffect(() => {
    const stack = stackRef.current!;
    const unsubscribe = stack.subscribe((newSnapshot) => {
      setSnapshot(newSnapshot);
    });
    return unsubscribe;
  }, []);

  const pushState = useCallback((newState: T | ((prev: T) => T), actionDescription?: string) => {
    if (!stackRef.current) return;
    const resolvedState =
      typeof newState === 'function'
        ? (newState as (prev: T) => T)(stackRef.current.present)
        : newState;
    stackRef.current.push(resolvedState, actionDescription);
  }, []);

  const undo = useCallback((): T | null => {
    return stackRef.current ? stackRef.current.undo() : null;
  }, []);

  const redo = useCallback((): T | null => {
    return stackRef.current ? stackRef.current.redo() : null;
  }, []);

  const jumpTo = useCallback((index: number): T | null => {
    return stackRef.current ? stackRef.current.jumpTo(index) : null;
  }, []);

  const clear = useCallback((newInitialState?: T) => {
    if (stackRef.current) {
      stackRef.current.clear(newInitialState);
    }
  }, []);

  return {
    state: snapshot.present,
    setState: pushState,
    undo,
    redo,
    jumpTo,
    clear,
    canUndo: snapshot.canUndo,
    canRedo: snapshot.canRedo,
    past: snapshot.past,
    future: snapshot.future,
    historyStack: stackRef.current,
  };
}
