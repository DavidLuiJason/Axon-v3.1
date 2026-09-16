import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { registerOffscreenStageRequester, StageHandle, getOptimalConcurrency } from '../lib/interfaceCaptureEngine';
import {
  getInterfaceComponent,
  registerInterfaceComponent,
  unregisterInterfaceComponent,
} from '../lib/interfaceComponentRegistry';

// Backwards compatibility re-exports for dynamic registration
export function registerDynamicStageComponent(
  route: string,
  component: React.ComponentType<any>
): void {
  registerInterfaceComponent(route, component);
}

export function unregisterDynamicStageComponent(route: string): void {
  unregisterInterfaceComponent(route);
}

export interface QueuedStageRequest {
  id: number;
  route: string;
  isFull: boolean;
  interfaceId?: string;
  priority: number; // 0 = high, 1 = normal, 2 = low
  createdAt: number;
  resolve: (handle: StageHandle | null) => void;
  reject: (err: any) => void;
}

let requestIdCounter = 0;

/**
 * Isolated error boundary for staged offscreen components.
 * Prevents any single screen render issue from unmounting the stage
 * or stalling the capture worker pool.
 */
class StageErrorBoundary extends React.Component<
  { children: React.ReactNode; route: string },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; route: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn(`Stage component error caught for route "${this.props.route}":`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 min-h-[300px] flex flex-col items-center justify-center p-6 text-center bg-neutral-950 text-neutral-300 font-mono text-xs border border-neutral-800 rounded-lg m-4">
          <div className="text-amber-400 font-semibold text-sm mb-2">Interface Render Notice</div>
          <div className="text-neutral-400 max-w-[340px] break-words">
            {this.state.error?.message || 'Component tree produced a rendering exception in stage'}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface StageSlotItemProps {
  slotId: number;
  request: QueuedStageRequest;
  themeMode: 'dark' | 'light';
  onReady: (slotId: number, element: HTMLElement) => void;
  onError: (slotId: number, error: Error) => void;
}

const StageSlotItem: React.FC<StageSlotItemProps> = ({
  slotId,
  request,
  themeMode,
  onReady,
  onError,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { route, isFull, interfaceId } = request;

  // Resolve component dynamically from registry
  const Component =
    (interfaceId ? getInterfaceComponent(interfaceId) : null) ||
    getInterfaceComponent(route);

  const formattedTitle = (interfaceId || route).replace(/[_/]/g, ' ').toUpperCase();
  const isOverlay = route.includes('drawer') || route.includes('modal');

  useEffect(() => {
    let isCancelled = false;
    const start = Date.now();

    const checkReadiness = () => {
      if (isCancelled) return;
      const el = containerRef.current;
      if (!el) {
        if (Date.now() - start > 4000) {
          onError(slotId, new Error(`Stage element unavailable for route "${route}"`));
          return;
        }
        requestAnimationFrame(checkReadiness);
        return;
      }

      // Check if critical DOM content is present
      const hasDimensions = el.offsetWidth > 0 || isOverlay;
      const hasContent = el.childElementCount > 0;

      // Check for pending images inside
      const pendingImages = Array.from(el.querySelectorAll<HTMLImageElement>('img')).filter(
        (img) => !img.complete && img.src
      );

      if (hasDimensions && hasContent && pendingImages.length === 0) {
        // Double RAF to guarantee style calculation and reflow settlement
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (!isCancelled && containerRef.current) {
              onReady(slotId, containerRef.current);
            }
          });
        });
      } else if (Date.now() - start > 2000) {
        // Safe readiness cap: after 2s proceed regardless so images don't block
        requestAnimationFrame(() => {
          if (!isCancelled && containerRef.current) {
            onReady(slotId, containerRef.current);
          }
        });
      } else {
        setTimeout(checkReadiness, 30);
      }
    };

    // Begin readiness monitoring immediately
    checkReadiness();

    return () => {
      isCancelled = true;
    };
  }, [slotId, route, isOverlay, onReady, onError]);

  return (
    <div
      id={`axon-offscreen-stage-slot-${slotId}`}
      data-capture-stage="true"
      data-slot-id={slotId}
      ref={containerRef}
      style={{
        position: 'fixed',
        left: `${-99999 - slotId * 1200}px`,
        top: 0,
        width: isOverlay ? 'auto' : '430px',
        minWidth: isOverlay ? '320px' : '430px',
        height: isFull ? 'auto' : '932px',
        minHeight: '932px',
        zIndex: -99999,
        visibility: 'visible',
        pointerEvents: 'none',
        overflow: isFull ? 'visible' : 'hidden',
        // Disable unnecessary animations and transitions during automated capture staging
        animationDuration: '0.001s',
        transitionDuration: '0.001s',
      }}
      className={`axon-capture-stage-container flex flex-col font-sans select-none ${
        themeMode === 'dark' ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-900'
      }`}
      aria-hidden="true"
    >
      {/* Offscreen Top Header Bar for full screens */}
      {!isOverlay && (
        <div className="h-12 w-full bg-black border-b border-neutral-800 px-3 flex items-center justify-between shrink-0">
          <span className="text-xs font-bold tracking-tight text-white">
            AXON • {formattedTitle}
          </span>
          <span className="text-[10px] font-mono text-neutral-400">UI PREVIEW</span>
        </div>
      )}

      {/* Screen Component with Isolated Error Boundary */}
      <div
        className={`flex-1 min-h-0 flex flex-col ${
          isFull ? 'h-auto overflow-visible' : 'overflow-hidden'
        }`}
      >
        <StageErrorBoundary route={route} key={`${route}-${interfaceId || ''}`}>
          {Component ? (
            <Component />
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-neutral-500 text-xs font-mono">
              Interface component for &quot;{route}&quot; not registered
            </div>
          )}
        </StageErrorBoundary>
      </div>
    </div>
  );
};

export const InterfaceCaptureOffscreenStage: React.FC = () => {
  const { theme } = useApp();
  const maxSlots = useRef<number>(getOptimalConcurrency());
  const [activeSlots, setActiveSlots] = useState<Map<number, QueuedStageRequest>>(new Map());
  const activeSlotsRef = useRef<Map<number, QueuedStageRequest>>(new Map());
  const queueRef = useRef<QueuedStageRequest[]>([]);

  // Keep ref synchronized with state
  useEffect(() => {
    activeSlotsRef.current = activeSlots;
  }, [activeSlots]);

  const dispatchNextInQueue = useCallback(() => {
    const currentActive = activeSlotsRef.current;
    const capacity = maxSlots.current;

    // Find all free slot indices [0 ... capacity-1]
    const freeSlots: number[] = [];
    for (let i = 0; i < capacity; i++) {
      if (!currentActive.has(i)) {
        freeSlots.push(i);
      }
    }

    if (freeSlots.length === 0 || queueRef.current.length === 0) {
      return;
    }

    // Sort queue by priority: lower number = higher priority
    queueRef.current.sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt);

    const updated = new Map(currentActive);
    for (const slotId of freeSlots) {
      if (queueRef.current.length === 0) break;
      const nextRequest = queueRef.current.shift()!;
      updated.set(slotId, nextRequest);
    }

    activeSlotsRef.current = updated;
    setActiveSlots(updated);
  }, []);

  const releaseSlot = useCallback(
    (slotId: number) => {
      const updated = new Map(activeSlotsRef.current);
      updated.delete(slotId);
      activeSlotsRef.current = updated;
      setActiveSlots(updated);

      // Micro-task yield before taking next item to keep foreground AXON responsive
      setTimeout(() => {
        dispatchNextInQueue();
      }, 10);
    },
    [dispatchNextInQueue]
  );

  const handleSlotReady = useCallback(
    (slotId: number, element: HTMLElement) => {
      const request = activeSlotsRef.current.get(slotId);
      if (!request) return;

      let hasReleased = false;
      const safeRelease = () => {
        if (hasReleased) return;
        hasReleased = true;
        releaseSlot(slotId);
      };

      // Watchdog timer: If caller fails to release within 8s, auto-release to prevent stalled worker
      const watchdogTimer = setTimeout(() => {
        if (!hasReleased) {
          console.warn(`Stage watchdog auto-released slot ${slotId} for "${request.route}"`);
          safeRelease();
        }
      }, 8000);

      const wrappedRelease = () => {
        clearTimeout(watchdogTimer);
        safeRelease();
      };

      request.resolve({
        element,
        slotId,
        release: wrappedRelease,
      });
    },
    [releaseSlot]
  );

  const handleSlotError = useCallback(
    (slotId: number, error: Error) => {
      const request = activeSlotsRef.current.get(slotId);
      if (request) {
        request.reject(error);
      }
      releaseSlot(slotId);
    },
    [releaseSlot]
  );

  useEffect(() => {
    // Register the bounded concurrent offscreen stage requester
    registerOffscreenStageRequester(
      (route: string, isFull: boolean, interfaceId?: string, priority: number = 1) => {
        return new Promise<StageHandle | null>((resolve, reject) => {
          const item: QueuedStageRequest = {
            id: ++requestIdCounter,
            route,
            isFull,
            interfaceId,
            priority,
            createdAt: Date.now(),
            resolve,
            reject,
          };
          queueRef.current.push(item);
          dispatchNextInQueue();
        });
      }
    );

    return () => {
      registerOffscreenStageRequester(null);
      queueRef.current = [];
      activeSlotsRef.current = new Map();
      setActiveSlots(new Map());
    };
  }, [dispatchNextInQueue]);

  return (
    <>
      {/* Single anchor ID for backwards-compatibility lookups */}
      <div id="axon-offscreen-capture-stage" style={{ display: 'none' }} />

      {/* Concurrent Offscreen Staging Slots */}
      {Array.from(activeSlots.entries()).map(([slotId, request]) => (
        <StageSlotItem
          key={`slot-${slotId}-${request.id}`}
          slotId={slotId}
          request={request}
          themeMode={theme.mode}
          onReady={handleSlotReady}
          onError={handleSlotError}
        />
      ))}
    </>
  );
};
