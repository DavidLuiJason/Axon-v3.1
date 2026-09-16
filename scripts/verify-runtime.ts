/**
 * Test runner for AXON Block 1: Runtime & Processing Foundation
 */

import { runRuntimeVerificationSuite } from '../src/lib/runtime/__tests__/runtimeVerification';

async function main() {
  console.log('--- Starting AXON Runtime Verification Suite ---');
  const report = await runRuntimeVerificationSuite();

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
  console.error('Fatal verification failure:', err);
  process.exit(1);
});
