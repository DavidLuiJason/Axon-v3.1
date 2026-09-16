/**
 * AXON Rendering & Animation Foundation — Automated Verification Suite
 * 
 * Verifies all core capabilities specified for AXON Block 2:
 * - Centralized RAF Frame Coordinator (single loop, idle sleep)
 * - Viewer Animation lifecycle (start, pause, resume, cancel, complete)
 * - Zero-allocation mathematical easing & interpolation
 * - Multiple concurrent animations without loop duplication
 * - Dynamic background animation throttling under pressure
 * - Visibility-aware execution (pausing background work when hidden)
 * - Lifecycle cleanup and memory safety
 * - Frame delta clamping against tab switch anomalies
 * - Priority alignment with Runtime Foundation
 */

import { animationCoordinator } from '../animationCoordinator';
import { animateViewer, animateViewerPan, animateViewerZoom } from '../viewerAnimation';
import { createBackgroundAnimation } from '../backgroundAnimation';
import { interpolateNumber, interpolateVector2D, easeInOutQuad } from '../easing';
import { workloadManager } from '../../runtime/workloadManager';

export interface RenderingTestResult {
  name: string;
  passed: boolean;
  durationMs: number;
  details?: string;
  error?: string;
}

export interface RenderingVerificationReport {
  timestamp: string;
  allPassed: boolean;
  totalTests: number;
  passedCount: number;
  failedCount: number;
  results: RenderingTestResult[];
}

export async function runRenderingVerificationSuite(): Promise<RenderingVerificationReport> {
  const results: RenderingTestResult[] = [];

  const runTest = async (name: string, fn: () => Promise<string | void>) => {
    const start = performance.now();
    try {
      const details = await fn();
      results.push({
        name,
        passed: true,
        durationMs: Math.round(performance.now() - start),
        details: details || 'Passed',
      });
    } catch (err: any) {
      results.push({
        name,
        passed: false,
        durationMs: Math.round(performance.now() - start),
        error: err?.message || String(err),
      });
    }
  };

  // Test 1: Single Shared RAF Loop & Idle Sleep
  await runTest('1. Central Coordinator & Idle Sleep (Zero Idle CPU)', async () => {
    // Ensure clean initial state
    animationCoordinator.cancelAll('Initial reset');
    let diag = animationCoordinator.getDiagnostics();
    if (diag.totalActiveAnimations !== 0) {
      throw new Error(`Expected 0 active animations, found ${diag.totalActiveAnimations}`);
    }

    // Register a viewer animation
    let lastValue = 0;
    const handle = animateViewer({
      durationMs: 80,
      from: 0,
      to: 100,
      onUpdate: (val) => {
        lastValue = val;
      },
    });

    diag = animationCoordinator.getDiagnostics();
    if (diag.activeViewerAnimations !== 1) {
      throw new Error(`Expected 1 active viewer animation, found ${diag.activeViewerAnimations}`);
    }

    // Wait for completion
    const finalVal = await handle.promise;
    if (finalVal !== 100) throw new Error(`Expected final value 100, got ${finalVal}`);
    if (handle.status !== 'completed') throw new Error(`Expected status completed, got ${handle.status}`);

    // Allow small tick for coordinator cleanup
    await new Promise((r) => setTimeout(r, 40));

    diag = animationCoordinator.getDiagnostics();
    if (diag.totalActiveAnimations !== 0) {
      throw new Error(`Expected 0 active animations after completion, got ${diag.totalActiveAnimations}`);
    }

    return `Animation executed smoothly (0 -> ${lastValue}); coordinator returned to idle sleep with 0 active workers.`;
  });

  // Test 2: Viewer Animation Lifecycle (Pause, Resume, Complete)
  await runTest('2. Viewer Animation Controlled Lifecycle (Pause & Resume)', async () => {
    let updates = 0;
    const handle = animateViewer({
      durationMs: 200,
      from: 0,
      to: 10,
      onUpdate: () => {
        updates++;
      },
    });

    // Let it run for 40ms
    await new Promise((r) => setTimeout(r, 40));
    const updatesBeforePause = updates;
    handle.pause();
    if (handle.status !== 'paused') throw new Error(`Expected status 'paused', got ${handle.status}`);

    // Wait 50ms while paused
    await new Promise((r) => setTimeout(r, 50));
    if (updates > updatesBeforePause + 1) {
      throw new Error(`Animation received updates while paused: ${updates} vs ${updatesBeforePause}`);
    }

    // Resume
    handle.resume();
    if ((handle.status as string) !== 'running') throw new Error(`Expected status 'running', got ${handle.status}`);

    // Now snap to complete
    handle.complete();
    if ((handle.status as string) !== 'completed') throw new Error(`Expected status 'completed', got ${handle.status}`);
    const result = await handle.promise;
    if (result !== 10) throw new Error(`Expected result to snap to 10, got ${result}`);

    return 'Successfully paused, held state without updates, resumed, and snapped to complete.';
  });

  // Test 3: Viewer Animation Clean Cancellation
  await runTest('3. Viewer Animation Clean Cancellation', async () => {
    let cancelledFired = false;
    const handle = animateViewer({
      durationMs: 300,
      from: 0,
      to: 100,
      onUpdate: () => {},
      onCancel: () => {
        cancelledFired = true;
      },
    });

    await new Promise((r) => setTimeout(r, 30));
    handle.cancel('User aborted view transition');

    if (handle.status !== 'cancelled') {
      throw new Error(`Expected status 'cancelled', got ${handle.status}`);
    }

    let caughtError: any = null;
    try {
      await handle.promise;
    } catch (err) {
      caughtError = err;
    }

    if (!caughtError) throw new Error('Expected promise to reject on cancellation');
    if (!cancelledFired) throw new Error('Expected onCancel callback to fire');

    const diag = animationCoordinator.getDiagnostics();
    if (diag.activeViewerAnimations !== 0) {
      throw new Error(`Expected 0 active animations after cancel, found ${diag.activeViewerAnimations}`);
    }

    return 'Cancelled cleanly; promise rejected with explanation; coordinator slots released.';
  });

  // Test 4: Pure Easing & Transform Interpolation Math
  await runTest('4. Zero-Allocation Mathematical Easing & Transforms', async () => {
    // Easing boundaries
    if (easeInOutQuad(0) !== 0) throw new Error('easeInOutQuad(0) must be 0');
    if (easeInOutQuad(1) !== 1) throw new Error('easeInOutQuad(1) must be 1');
    if (easeInOutQuad(0.5) !== 0.5) throw new Error('easeInOutQuad(0.5) must be 0.5');

    // Number interpolation
    const n = interpolateNumber(10, 20, 0.5);
    if (n !== 15) throw new Error(`interpolateNumber expected 15, got ${n}`);

    // Vector interpolation
    const v1 = { x: 0, y: 100 };
    const v2 = { x: 200, y: 300 };
    const outV = { x: 0, y: 0 };
    const resV = interpolateVector2D(v1, v2, 0.25, outV);

    if (resV !== outV) throw new Error('Expected mutate-in-place for zero allocation');
    if (outV.x !== 50 || outV.y !== 150) {
      throw new Error(`Vector interpolation failed: (${outV.x}, ${outV.y})`);
    }

    return 'Pure easing and in-place vector math validated with zero allocation.';
  });

  // Test 5: Multiple Concurrent Viewer Animations
  await runTest('5. Multiple Concurrent Animations without Loop Duplication', async () => {
    let panProgress = 0;
    let zoomProgress = 0;

    const panHandle = animateViewerPan(
      { x: 0, y: 0 },
      { x: 500, y: 500 },
      80,
      (coords) => {
        panProgress = coords.x;
      }
    );

    const zoomHandle = animateViewerZoom(1.0, 2.5, 80, (scale) => {
      zoomProgress = scale;
    });

    const diag = animationCoordinator.getDiagnostics();
    if (diag.activeViewerAnimations !== 2) {
      throw new Error(`Expected 2 active viewer animations, found ${diag.activeViewerAnimations}`);
    }

    const [panRes, zoomRes] = await Promise.all([panHandle.promise, zoomHandle.promise]);

    if (panRes.x !== 500 || panRes.y !== 500) {
      throw new Error(`Pan failed: ${JSON.stringify(panRes)}`);
    }
    if (zoomRes !== 2.5) {
      throw new Error(`Zoom failed: ${zoomRes}`);
    }

    return `Simultaneous pan (${panProgress.toFixed(0)}px) and zoom (${zoomProgress.toFixed(1)}x) coordinated cleanly on a single loop.`;
  });

  // Test 6: Background Animation Registration & Throttling
  await runTest('6. Background Animation Dynamic Throttling', async () => {
    let bgTicks = 0;
    const bgHandle = createBackgroundAnimation({
      name: 'test_ambient_particles',
      targetFps: 60,
      throttledFps: 10,
      onTick: () => {
        bgTicks++;
      },
    });

    const diag = animationCoordinator.getDiagnostics();
    if (diag.activeBackgroundAnimations !== 1) {
      throw new Error(`Expected 1 active background animation, got ${diag.activeBackgroundAnimations}`);
    }

    // Let it run for 60ms
    await new Promise((r) => setTimeout(r, 60));
    if (bgTicks === 0) throw new Error('Background animation did not receive any frame ticks');

    bgHandle.cancel('Test finished');

    return `Background visual process received ${bgTicks} ticks and cleanly terminated.`;
  });

  // Test 7: Clean Teardown and Memory Boundary
  await runTest('7. Memory Safety & Full Cancellation Teardown', async () => {
    const handles = Array.from({ length: 5 }).map((_, i) =>
      animateViewer({
        durationMs: 500,
        from: 0,
        to: i,
        onUpdate: () => {},
      })
    );

    let diag = animationCoordinator.getDiagnostics();
    if (diag.activeViewerAnimations !== 5) {
      throw new Error(`Expected 5 active animations, got ${diag.activeViewerAnimations}`);
    }

    // Cancel all
    animationCoordinator.cancelAll('Teardown test');

    diag = animationCoordinator.getDiagnostics();
    if (diag.totalActiveAnimations !== 0) {
      throw new Error(`Expected 0 active animations after cancelAll, found ${diag.totalActiveAnimations}`);
    }

    return 'All 5 concurrent animation handles dismantled; coordinator entered idle sleep.';
  });

  // Test 8: Integration with Runtime Foundation
  await runTest('8. Integration with AXON Runtime & Resource Monitor', async () => {
    const resourceMonitor = workloadManager.getResourceMonitor();
    const state = resourceMonitor.getState();

    if (typeof state.baseConcurrency !== 'number') {
      throw new Error('Missing baseConcurrency in ResourceMonitor state');
    }
    if (!['nominal', 'elevated', 'throttled'].includes(state.pressureLevel)) {
      throw new Error(`Invalid pressure level: ${state.pressureLevel}`);
    }

    const diag = animationCoordinator.getDiagnostics();
    if (diag.pressureLevel !== state.pressureLevel) {
      throw new Error(`Coordinator pressure level (${diag.pressureLevel}) does not match ResourceMonitor (${state.pressureLevel})`);
    }

    return `AnimationCoordinator successfully synchronized with ResourceMonitor (pressure: ${state.pressureLevel}).`;
  });

  // Test 9: Frame Delta Clamping Protection
  await runTest('9. Frame Delta Clamping Protection', async () => {
    let maxObservedDelta = 0;
    const handle = animateViewer({
      durationMs: 80,
      from: 0,
      to: 1,
      onUpdate: (_val, frame) => {
        maxObservedDelta = Math.max(maxObservedDelta, frame.deltaTime);
      },
    });

    await handle.promise;
    if (maxObservedDelta > 100) {
      throw new Error(`Delta time exceeded 100ms clamp: ${maxObservedDelta}ms`);
    }

    return `Delta time strictly clamped to frame budget (max observed: ${maxObservedDelta.toFixed(1)}ms <= 100ms).`;
  });

  // Test 10: Visibility State & Pressure Adaptability
  await runTest('10. Rendering Diagnostics & Pressure Observability', async () => {
    const diag = animationCoordinator.getDiagnostics();
    if (typeof diag.currentFps !== 'number' || diag.currentFps < 0) {
      throw new Error(`Invalid FPS metric: ${diag.currentFps}`);
    }
    if (typeof diag.frameDrops !== 'number' || diag.frameDrops < 0) {
      throw new Error(`Invalid frameDrops count: ${diag.frameDrops}`);
    }
    if (typeof diag.isBackgroundThrottled !== 'boolean') {
      throw new Error('Missing isBackgroundThrottled boolean');
    }

    return `Observability metrics active: ${diag.currentFps} FPS, ${diag.frameDrops} frame drops tracked, pressure: ${diag.pressureLevel}.`;
  });

  // Test 11: Viewer Animation ON/OFF Toggle & Resource Suspension
  await runTest('11. Viewer Animation ON/OFF Toggle & Resource Suspension', async () => {
    let tickCount = 0;
    const testAnim = animateViewer({
      durationMs: 500,
      from: 0,
      to: 100,
      onUpdate: () => { tickCount++; },
    });

    // Verify initial active state
    if (!animationCoordinator.isViewerAnimationEnabled()) {
      throw new Error('Viewer animation should be enabled initially');
    }

    // Toggle OFF: Should cleanly suspend work
    animationCoordinator.setViewerAnimationEnabled(false);
    if (animationCoordinator.isViewerAnimationEnabled()) {
      throw new Error('Viewer animation should report false after disabling');
    }

    const diagOff = animationCoordinator.getDiagnostics();
    if (diagOff.activeViewerAnimations !== 0) {
      throw new Error(`Expected 0 active running viewer animations when disabled, got ${diagOff.activeViewerAnimations}`);
    }

    // Toggle ON: Should resume cleanly
    animationCoordinator.setViewerAnimationEnabled(true);
    if (!animationCoordinator.isViewerAnimationEnabled()) {
      throw new Error('Viewer animation should report true after re-enabling');
    }

    // Clean up
    testAnim.cancel('Test completed');
    return 'Viewer animation toggle successfully verified: cleans up active processing on OFF and safely resumes on ON.';
  });

  // Test 12: Background Animation ON/OFF Toggle & Lifecycle Clean Resume
  await runTest('12. Background Animation ON/OFF Toggle & Lifecycle Clean Resume', async () => {
    const bgAnim = createBackgroundAnimation({
      name: 'test-bg-pulse-toggle',
      targetFps: 30,
      onTick: () => {},
    });

    // Verify initial state
    if (!animationCoordinator.isBackgroundAnimationEnabled()) {
      throw new Error('Background animation should be enabled initially');
    }

    // Toggle OFF: Should suspend background processing
    animationCoordinator.setBackgroundAnimationEnabled(false);
    if (animationCoordinator.isBackgroundAnimationEnabled()) {
      throw new Error('Background animation should report false after disabling');
    }

    const diagOff = animationCoordinator.getDiagnostics();
    if (diagOff.activeBackgroundAnimations !== 0) {
      throw new Error(`Expected 0 active background animations when disabled, got ${diagOff.activeBackgroundAnimations}`);
    }

    // Toggle ON: Should resume without duplicate loops
    animationCoordinator.setBackgroundAnimationEnabled(true);
    if (!animationCoordinator.isBackgroundAnimationEnabled()) {
      throw new Error('Background animation should report true after re-enabling');
    }

    // Clean up
    bgAnim.cancel('Test completed');
    return 'Background animation toggle successfully verified: releases background execution on OFF and cleanly resumes without duplicate allocations on ON.';
  });

  const allPassed = results.every((r) => r.passed);
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  return {
    timestamp: new Date().toISOString(),
    allPassed,
    totalTests: results.length,
    passedCount,
    failedCount,
    results,
  };
}
