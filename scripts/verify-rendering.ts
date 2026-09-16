/**
 * Test runner for AXON Block 2: Rendering & Animation Foundation
 */

import { runRenderingVerificationSuite } from '../src/lib/rendering/__tests__/renderingVerification';

async function main() {
  console.log('--- Starting AXON Rendering Verification Suite ---');
  const report = await runRenderingVerificationSuite();

  console.log(`\nVerification Complete! All Passed: ${report.allPassed}`);
  console.log(`Tests Run: ${report.totalTests} | Passed: ${report.passedCount} | Failed: ${report.failedCount}\n`);

  for (const r of report.results) {
    const symbol = r.passed ? '✓' : '✗';
    console.log(`${symbol} [${r.durationMs}ms] ${r.name}: ${r.details || r.error}`);
  }

  if (!report.allPassed) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal rendering verification failure:', err);
  process.exit(1);
});
