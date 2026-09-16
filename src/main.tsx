import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { workloadManager, runRuntimeVerificationSuite } from './lib/runtime';

// Initialize AXON Central Runtime & expose unobtrusive developer diagnostics
if (typeof window !== 'undefined') {
  (window as any).__AXON_WORKLOAD_MANAGER__ = workloadManager;
  (window as any).__AXON_RUNTIME__ = {
    manager: workloadManager,
    getDiagnostics: () => workloadManager.getDiagnostics(),
    submit: (cfg: any) => workloadManager.submit(cfg),
    run: (cfg: any) => workloadManager.run(cfg),
    cancel: (id: string, reason?: string) => workloadManager.cancelTask(id, reason),
    runVerificationSuite: () => runRuntimeVerificationSuite(),
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
