import React, { useRef, useEffect, useCallback } from 'react';

export interface SwipeableTabContainerProps<T extends string> {
  tabs: readonly T[] | T[];
  activeTab: T;
  onTabChange: (newTab: T) => void;
  children: React.ReactNode;
  className?: string;
  fitHeight?: boolean;
}

export function SwipeableTabContainer<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  children,
  className = '',
  fitHeight = false,
}: SwipeableTabContainerProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLDivElement | null)[]>([]);

  const childArray = React.Children.toArray(children);
  const isSingleChild = childArray.length === 1 && tabs.length > 1;

  const rawIndex = tabs.indexOf(activeTab);
  const currentIndex = rawIndex >= 0 ? rawIndex : 0;
  const numTabs = isSingleChild ? 1 : Math.max(1, tabs.length);
  const basePercent = isSingleChild ? 0 : -(currentIndex * 100) / numTabs;

  // Direct gesture tracking refs - zero React re-renders during active drag
  const isGesturingRef = useRef<boolean>(false);
  const isAnimatingRef = useRef<boolean>(false);
  const dragOffsetRef = useRef<number>(0);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchStartTimeRef = useRef<number>(0);
  const gestureLockRef = useRef<'horizontal' | 'vertical' | null>(null);
  const isMouseActiveRef = useRef<boolean>(false);
  const animationTimerRef = useRef<number | null>(null);
  const prevIndexRef = useRef<number>(currentIndex);

  // Performance cache refs to eliminate layout reflows during active dragging
  const cachedHeightsRef = useRef<number[]>([]);
  const containerWidthRef = useRef<number>(360);
  const rafIdRef = useRef<number | null>(null);
  const latestOffsetRef = useRef<number>(0);

  // Synchronize container height with active tab in non-fitHeight mode
  const syncHeight = useCallback((targetIdx = currentIndex) => {
    if (fitHeight || !containerRef.current) return;
    const activePanel = tabRefs.current[targetIdx];
    if (activePanel) {
      const h = activePanel.offsetHeight;
      if (h > 0) {
        containerRef.current.style.height = `${h}px`;
      }
    }
  }, [currentIndex, fitHeight]);

  // Handle activeTab / currentIndex changes programmatically (tab button click, etc.)
  useEffect(() => {
    // If a gesture animation is actively running, do not interrupt or restart it
    if (isAnimatingRef.current || isGesturingRef.current) {
      prevIndexRef.current = currentIndex;
      return;
    }

    if (trackRef.current) {
      trackRef.current.style.transition = 'transform 0.26s cubic-bezier(0.16, 1, 0.3, 1)';
      trackRef.current.style.transform = `translate3d(${basePercent}%, 0, 0)`;

      if (animationTimerRef.current !== null) {
        window.clearTimeout(animationTimerRef.current);
      }
      animationTimerRef.current = window.setTimeout(() => {
        animationTimerRef.current = null;
      }, 280);
    }

    syncHeight(currentIndex);
    const rAF = requestAnimationFrame(() => {
      syncHeight(currentIndex);
    });
    prevIndexRef.current = currentIndex;

    return () => cancelAnimationFrame(rAF);
  }, [activeTab, basePercent, currentIndex, syncHeight]);

  // Resize observer to adapt container height when content dynamically changes
  useEffect(() => {
    if (fitHeight) return;
    const activePanel = tabRefs.current[currentIndex];
    if (!activePanel) return;

    const observer = new ResizeObserver(() => {
      syncHeight(currentIndex);
    });

    observer.observe(activePanel);
    return () => observer.disconnect();
  }, [currentIndex, fitHeight, syncHeight]);

  // Adapt height when children change (e.g. search query or list filtering)
  useEffect(() => {
    if (!fitHeight) {
      syncHeight(currentIndex);
      const rAF = requestAnimationFrame(() => {
        syncHeight(currentIndex);
      });
      return () => cancelAnimationFrame(rAF);
    }
  }, [children, currentIndex, fitHeight, syncHeight]);

  // Window resize handler to maintain accurate container dimensions
  useEffect(() => {
    const handleResize = () => {
      containerWidthRef.current = containerRef.current?.clientWidth || window.innerWidth || 360;
      if (!fitHeight) {
        syncHeight(currentIndex);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentIndex, fitHeight, syncHeight]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationTimerRef.current !== null) {
        window.clearTimeout(animationTimerRef.current);
      }
    };
  }, []);

  const isIgnoredTarget = (target: HTMLElement | null, forMouse = false): boolean => {
    if (!target) return false;
    const baseSelector =
      'input, textarea, select, [contenteditable="true"], .no-tab-swipe, .no-swipe-gesture, [data-no-swipe]';
    const mouseSelector =
      'input, textarea, select, button, a, [role="button"], [contenteditable="true"], .no-tab-swipe, .no-swipe-gesture, [data-no-swipe]';
    return Boolean(target.closest(forMouse ? mouseSelector : baseSelector));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (numTabs <= 1) return;
    if (isIgnoredTarget(e.target as HTMLElement | null)) {
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      gestureLockRef.current = null;
      return;
    }

    if (e.touches.length === 1) {
      containerWidthRef.current = containerRef.current?.clientWidth || window.innerWidth || 360;
      if (!fitHeight) {
        cachedHeightsRef.current = tabRefs.current.map((el) => el?.offsetHeight || 0);
      }

      if (animationTimerRef.current !== null) {
        window.clearTimeout(animationTimerRef.current);
        animationTimerRef.current = null;
      }
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      isAnimatingRef.current = false;

      if (trackRef.current) {
        const comp = window.getComputedStyle(trackRef.current);
        if (comp.transform && comp.transform !== 'none') {
          try {
            const matrix = new DOMMatrixReadOnly(comp.transform);
            trackRef.current.style.transition = 'none';
            trackRef.current.style.transform = `translate3d(${matrix.m41}px, 0, 0)`;
          } catch {
            trackRef.current.style.transition = 'none';
          }
        } else {
          trackRef.current.style.transition = 'none';
        }
      }

      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
      touchStartTimeRef.current = Date.now();
      gestureLockRef.current = null;
      isGesturingRef.current = false;
      dragOffsetRef.current = 0;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null || e.touches.length !== 1) {
      return;
    }

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - touchStartXRef.current;
    const diffY = currentY - touchStartYRef.current;

    // Lock direction on first threshold pass
    if (gestureLockRef.current === null) {
      if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 8) {
        gestureLockRef.current = 'vertical';
        return;
      }
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 8) {
        gestureLockRef.current = 'horizontal';
        isGesturingRef.current = true;
      }
    }

    if (gestureLockRef.current === 'horizontal') {
      if (e.cancelable) {
        e.preventDefault();
      }

      // 1:1 real-time drag following with elastic resistance at boundaries
      let offset = diffX;
      const isAtFirst = currentIndex === 0;
      const isAtLast = currentIndex === numTabs - 1;

      if ((isAtFirst && diffX > 0) || (isAtLast && diffX < 0)) {
        offset = diffX * 0.22;
      }

      dragOffsetRef.current = offset;
      latestOffsetRef.current = offset;

      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null;
          const currentOff = latestOffsetRef.current;
          if (trackRef.current) {
            trackRef.current.style.transform = `translate3d(calc(${basePercent}% + ${currentOff}px), 0, 0)`;
          }
          if (!fitHeight && containerRef.current && cachedHeightsRef.current.length > 0) {
            const candidateIdx = currentOff < 0 ? Math.min(numTabs - 1, currentIndex + 1) : Math.max(0, currentIndex - 1);
            const currentH = cachedHeightsRef.current[currentIndex] || 0;
            const candidateH = cachedHeightsRef.current[candidateIdx] || 0;
            const maxH = Math.max(currentH, candidateH);
            if (maxH > 0) {
              containerRef.current.style.height = `${maxH}px`;
            }
          }
        });
      }
    }
  };

  const finishGesture = useCallback((diffX: number, velocity: number) => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    const containerWidth = containerWidthRef.current || containerRef.current?.clientWidth || window.innerWidth || 360;
    const switchThreshold = Math.min(containerWidth * 0.22, 75);
    const fastFlick = Math.abs(velocity) > 0.32 && Math.abs(diffX) > 22;

    let targetIndex = currentIndex;
    if (diffX < -switchThreshold || (fastFlick && diffX < 0)) {
      if (currentIndex < numTabs - 1) {
        targetIndex = currentIndex + 1;
      }
    } else if (diffX > switchThreshold || (fastFlick && diffX > 0)) {
      if (currentIndex > 0) {
        targetIndex = currentIndex - 1;
      }
    }

    const targetPercent = -(targetIndex * 100) / numTabs;

    if (trackRef.current) {
      isAnimatingRef.current = true;
      const isSwitch = targetIndex !== currentIndex;
      trackRef.current.style.transition = isSwitch
        ? 'transform 0.26s cubic-bezier(0.16, 1, 0.3, 1)'
        : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)';
      trackRef.current.style.transform = `translate3d(${targetPercent}%, 0, 0)`;

      const onEnd = () => {
        if (animationTimerRef.current !== null) {
          window.clearTimeout(animationTimerRef.current);
          animationTimerRef.current = null;
        }
        isAnimatingRef.current = false;
      };

      trackRef.current.addEventListener('transitionend', onEnd, { once: true });
      if (animationTimerRef.current !== null) {
        window.clearTimeout(animationTimerRef.current);
      }
      animationTimerRef.current = window.setTimeout(onEnd, 280);
    }

    if (!fitHeight && containerRef.current) {
      const targetH = tabRefs.current[targetIndex]?.offsetHeight || 0;
      if (targetH > 0) {
        containerRef.current.style.height = `${targetH}px`;
      }
    }

    if (targetIndex !== currentIndex) {
      onTabChange(tabs[targetIndex]);
    }

    isGesturingRef.current = false;
    dragOffsetRef.current = 0;
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    gestureLockRef.current = null;
    isMouseActiveRef.current = false;
  }, [currentIndex, fitHeight, numTabs, onTabChange, tabs]);

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (touchStartXRef.current === null) {
      isGesturingRef.current = false;
      dragOffsetRef.current = 0;
      return;
    }

    if (gestureLockRef.current === 'horizontal') {
      const currentX = e.changedTouches[0].clientX;
      const diffX = currentX - touchStartXRef.current;
      const dt = Math.max(1, Date.now() - touchStartTimeRef.current);
      const velocity = diffX / dt;
      finishGesture(diffX, velocity);
    } else {
      isGesturingRef.current = false;
      dragOffsetRef.current = 0;
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      gestureLockRef.current = null;
      if (trackRef.current) {
        trackRef.current.style.transition = 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)';
        trackRef.current.style.transform = `translate3d(${basePercent}%, 0, 0)`;
      }
    }
  };

  const handleTouchCancel = () => {
    isGesturingRef.current = false;
    dragOffsetRef.current = 0;
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    gestureLockRef.current = null;
    if (trackRef.current) {
      trackRef.current.style.transition = 'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)';
      trackRef.current.style.transform = `translate3d(${basePercent}%, 0, 0)`;
    }
    syncHeight(currentIndex);
  };

  // Mouse drag support for desktop pointer testing
  const handleMouseDown = (e: React.MouseEvent) => {
    if (numTabs <= 1) return;
    if (e.button !== 0) return;
    if (isIgnoredTarget(e.target as HTMLElement | null, true)) return;

    containerWidthRef.current = containerRef.current?.clientWidth || window.innerWidth || 360;
    if (!fitHeight) {
      cachedHeightsRef.current = tabRefs.current.map((el) => el?.offsetHeight || 0);
    }

    if (animationTimerRef.current !== null) {
      window.clearTimeout(animationTimerRef.current);
      animationTimerRef.current = null;
    }
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    isAnimatingRef.current = false;

    if (trackRef.current) {
      const comp = window.getComputedStyle(trackRef.current);
      if (comp.transform && comp.transform !== 'none') {
        try {
          const matrix = new DOMMatrixReadOnly(comp.transform);
          trackRef.current.style.transition = 'none';
          trackRef.current.style.transform = `translate3d(${matrix.m41}px, 0, 0)`;
        } catch {
          trackRef.current.style.transition = 'none';
        }
      } else {
        trackRef.current.style.transition = 'none';
      }
    }

    touchStartXRef.current = e.clientX;
    touchStartYRef.current = e.clientY;
    touchStartTimeRef.current = Date.now();
    gestureLockRef.current = null;
    isMouseActiveRef.current = true;
    isGesturingRef.current = false;
    dragOffsetRef.current = 0;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isMouseActiveRef.current || touchStartXRef.current === null || touchStartYRef.current === null) {
        return;
      }

      const diffX = e.clientX - touchStartXRef.current;
      const diffY = e.clientY - touchStartYRef.current;

      if (gestureLockRef.current === null) {
        if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 8) {
          gestureLockRef.current = 'vertical';
          return;
        }
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 8) {
          gestureLockRef.current = 'horizontal';
          isGesturingRef.current = true;
        }
      }

      if (gestureLockRef.current === 'horizontal') {
        let offset = diffX;
        const isAtFirst = currentIndex === 0;
        const isAtLast = currentIndex === numTabs - 1;

        if ((isAtFirst && diffX > 0) || (isAtLast && diffX < 0)) {
          offset = diffX * 0.22;
        }

        dragOffsetRef.current = offset;
        latestOffsetRef.current = offset;

        if (rafIdRef.current === null) {
          rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = null;
            const currentOff = latestOffsetRef.current;
            if (trackRef.current) {
              trackRef.current.style.transform = `translate3d(calc(${basePercent}% + ${currentOff}px), 0, 0)`;
            }
            if (!fitHeight && containerRef.current && cachedHeightsRef.current.length > 0) {
              const candidateIdx = currentOff < 0 ? Math.min(numTabs - 1, currentIndex + 1) : Math.max(0, currentIndex - 1);
              const currentH = cachedHeightsRef.current[currentIndex] || 0;
              const candidateH = cachedHeightsRef.current[candidateIdx] || 0;
              const maxH = Math.max(currentH, candidateH);
              if (maxH > 0) {
                containerRef.current.style.height = `${maxH}px`;
              }
            }
          });
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (!isMouseActiveRef.current || touchStartXRef.current === null) return;

      if (gestureLockRef.current === 'horizontal') {
        const diffX = e.clientX - touchStartXRef.current;
        const dt = Math.max(1, Date.now() - touchStartTimeRef.current);
        const velocity = diffX / dt;
        finishGesture(diffX, velocity);
      } else {
        isGesturingRef.current = false;
        dragOffsetRef.current = 0;
        isMouseActiveRef.current = false;
        touchStartXRef.current = null;
        touchStartYRef.current = null;
        gestureLockRef.current = null;
        if (trackRef.current) {
          trackRef.current.style.transition = 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)';
          trackRef.current.style.transform = `translate3d(${basePercent}%, 0, 0)`;
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [basePercent, currentIndex, finishGesture, fitHeight, numTabs]);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onMouseDown={handleMouseDown}
      style={{
        touchAction: 'pan-y',
        transition: fitHeight ? 'none' : 'height 0.26s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
      className={`relative w-full overflow-hidden select-none isolate ${
        fitHeight ? 'h-full min-h-0 flex flex-col' : ''
      } ${className}`}
    >
      {/* 1:1 Hardware-Accelerated Sliding Track */}
      <div
        ref={trackRef}
        style={{
          display: 'flex',
          flexDirection: 'row',
          width: `${numTabs * 100}%`,
          transform: `translate3d(${basePercent}%, 0, 0)`,
          willChange: 'transform',
          WebkitBackfaceVisibility: 'hidden',
          backfaceVisibility: 'hidden',
          WebkitTransformStyle: 'flat',
          transformStyle: 'flat',
          isolation: 'isolate',
          backgroundColor: '#000000',
        }}
        className={`w-full ${fitHeight ? 'h-full min-h-0' : 'items-start'}`}
      >
        {childArray.map((child, index) => {
          return (
            <div
              key={tabs[index] ?? index}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              style={{
                width: `${100 / numTabs}%`,
                minWidth: `${100 / numTabs}%`,
                flexShrink: 0,
                position: 'relative',
                isolation: 'isolate',
                WebkitBackfaceVisibility: 'hidden',
                backfaceVisibility: 'hidden',
                WebkitTransform: 'translateZ(0)',
                transform: 'translateZ(0)',
                contain: 'layout',
                backgroundColor: '#000000',
                ...(fitHeight ? { height: '100%', minHeight: 0 } : { height: 'auto' }),
              }}
              className={`shrink-0 ${fitHeight ? 'h-full min-h-0 overflow-y-auto' : ''}`}
            >
              {child}
            </div>
          );
        })}
      </div>
    </div>
  );
}
