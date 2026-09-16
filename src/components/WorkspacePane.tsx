import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { SwipeableTabContainer } from './SwipeableTabContainer';
import { formatPyDroidTraceback } from '../utils/codeTraceback';
import {
  FileCode2,
  Play,
  Copy,
  Check,
  Eye,
  RotateCcw,
  Trash2,
  Save,
  CheckCircle2,
  Monitor,
  Smartphone,
  Tablet,
  Code,
  History,
  Search,
  X,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { WorkspaceSnippetHistoryItem, WorkspaceMode, FormattedTraceback } from '../types';

type ViewportSize = 'desktop' | 'tablet' | 'mobile';

interface ConsoleLog {
  id: string;
  type: 'log' | 'info' | 'warn' | 'error' | 'return';
  text: string;
  timestamp: string;
}

const DEFAULT_JS_CODE = `// AXON Workspace Engine
// Safe client-side execution & rapid prototyping

function generateSystemReport() {
  const memoryEstimate = performance?.memory
    ? Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + ' MB'
    : 'Optimized (<64 MB)';

  return {
    engine: 'AXON Unified Intelligence',
    status: 'Operational',
    deviceTier: 'Mobile Low-Spec Adaptive',
    memoryUsage: memoryEstimate,
    timestamp: new Date().toLocaleTimeString(),
    cores: navigator.hardwareConcurrency || 4,
    metrics: [
      { name: 'Cold Start Latency', value: '12ms', status: 'Optimal' },
      { name: 'Local Cache State', value: 'Hydrated', status: 'Healthy' },
      { name: 'Execution Sandbox', value: 'Secure Client-Side', status: 'Active' },
    ]
  };
}

return generateSystemReport();`;

const DEFAULT_HTML_CODE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 24px;
      background: #09090b;
      color: #fafafa;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 80vh;
      text-align: center;
    }
    .card {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 16px;
      padding: 24px;
      max-width: 380px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 9999px;
      background: #22c55e20;
      color: #4ade80;
      border: 1px solid #22c55e40;
      font-size: 11px;
      font-weight: 600;
      margin-bottom: 12px;
    }
    h2 { margin: 0 0 8px; font-size: 18px; font-weight: 600; }
    p { margin: 0 0 16px; font-size: 13px; color: #a1a1aa; line-height: 1.5; }
    button {
      background: #ffffff;
      color: #000000;
      border: none;
      padding: 8px 16px;
      border-radius: 10px;
      font-weight: 600;
      font-size: 12px;
      cursor: pointer;
      transition: transform 0.1s, opacity 0.2s;
    }
    button:active { transform: scale(0.96); }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">LIVE PREVIEW</div>
    <h2>AXON Interactive Sandbox</h2>
    <p>This document is rendered securely in the unified Workspace Preview view.</p>
    <button onclick="increment()">Click Me</button>
    <div id="countDisplay" style="margin-top: 12px; font-size: 12px; color: #71717a;">Clicks: 0</div>
  </div>

  <script>
    let clicks = 0;
    function increment() {
      clicks++;
      document.getElementById('countDisplay').innerText = 'Clicks: ' + clicks;
      console.log('Button clicked, total clicks:', clicks);
    }
  </script>
</body>
</html>`;

export interface WorkspacePaneProps {
  initialTab?: 'code' | 'preview';
}

export const WorkspacePane: React.FC<WorkspacePaneProps> = ({ initialTab }) => {
  const {
    showToast,
    activeProjectMessages,
    saveScript,
    workspaceSnippetHistory,
    addWorkspaceSnippetHistory,
    deleteWorkspaceSnippetHistoryItem,
    clearWorkspaceSnippetHistory,
    workspaceCode,
    setWorkspaceCode,
    workspaceMode,
    setWorkspaceMode,
    workspaceActiveTab,
    setWorkspaceActiveTab,
    workspaceExecutionError,
    setWorkspaceExecutionError,
    addChatNotification,
  } = useApp();

  // Local state for initialTab override during background capture
  const [stagedTab, setStagedTab] = useState<'code' | 'preview' | null>(initialTab || null);
  const activeTab = stagedTab ?? workspaceActiveTab;
  const handleTabChange = (tab: 'code' | 'preview') => {
    if (stagedTab !== null) setStagedTab(tab);
    setWorkspaceActiveTab(tab);
  };

  // Local state for UI controls
  const [isCopied, setIsCopied] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null);
  const [viewportSize, setViewportSize] = useState<ViewportSize>('desktop');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [isHtmlConsoleOpen, setIsHtmlConsoleOpen] = useState(false);
  const [htmlConsoleLogs, setHtmlConsoleLogs] = useState<ConsoleLog[]>([]);
  const lastAutoLoadedCodeRef = useRef<string>('');

  // Persistent Code History inline display toggle
  const [showInlineHistory, setShowInlineHistory] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('axon_workspace_show_inline_history_v1');
      if (saved !== null) return saved === 'true';
    } catch {}
    return true;
  });

  const toggleInlineHistory = () => {
    setShowInlineHistory((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('axon_workspace_show_inline_history_v1', String(next));
      } catch {}
      return next;
    });
  };

  const handleSnapshotCurrent = () => {
    if (!workspaceCode.trim()) {
      showToast('No code to save to history');
      return;
    }
    const firstLine = workspaceCode.split('\n')[0].replace(/^\/\/\s*|^<!--\s*|^#\s*/, '').trim();
    const title = firstLine && firstLine.length < 50 ? firstLine : `Saved ${workspaceMode.toUpperCase()} Snapshot`;
    addWorkspaceSnippetHistory({
      title,
      code: workspaceCode,
      language: workspaceMode,
      source: 'editor_save',
    });
    showToast('Saved current code snapshot to history');
  };

  // Terminal logs for JS/JSON modes
  const [logs, setLogs] = useState<ConsoleLog[]>([
    {
      id: 'init',
      type: 'info',
      text: 'AXON Unified Workspace Engine ready. Press "Run Code" to execute.',
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [replInput, setReplInput] = useState('');

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-detect latest code block in chat
  const detectedChatCode = useMemo(() => {
    if (!activeProjectMessages || activeProjectMessages.length === 0) return null;
    for (let i = activeProjectMessages.length - 1; i >= 0; i--) {
      const msg = activeProjectMessages[i];
      const match = msg.text.match(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/);
      if (match && match[2].trim()) {
        const lang = (match[1] || 'javascript').toLowerCase();
        return {
          lang,
          code: match[2].trim(),
          source: msg.sender === 'user' ? 'User prompt' : 'AXON response',
        };
      }
    }
    return null;
  }, [activeProjectMessages]);

  // Whenever AXON generates code, it auto-loads into the Code view immediately — no button, no toggle
  useEffect(() => {
    if (detectedChatCode && detectedChatCode.code !== lastAutoLoadedCodeRef.current) {
      lastAutoLoadedCodeRef.current = detectedChatCode.code;
      setWorkspaceCode(detectedChatCode.code);
      let targetMode: WorkspaceMode = 'javascript';
      if (
        detectedChatCode.lang === 'html' ||
        detectedChatCode.code.includes('<html') ||
        detectedChatCode.code.includes('<!DOCTYPE')
      ) {
        targetMode = 'html';
      } else if (detectedChatCode.lang === 'json') {
        targetMode = 'json';
      }
      setWorkspaceMode(targetMode);
      setWorkspaceExecutionError(null);
      setWorkspaceActiveTab('code');

      const firstLine = detectedChatCode.code.split('\n')[0].replace(/^\/\/\s*|^<!--\s*|^#\s*/, '').trim();
      const snippetTitle = firstLine && firstLine.length < 50 ? firstLine : `Generated ${targetMode.toUpperCase()}`;
      addWorkspaceSnippetHistory({
        title: snippetTitle,
        code: detectedChatCode.code,
        language: targetMode,
        source: 'chat_auto',
      });
      showToast(`Code auto-loaded into Code view (${targetMode.toUpperCase()})`);
    }
  }, [
    detectedChatCode,
    setWorkspaceCode,
    setWorkspaceMode,
    setWorkspaceActiveTab,
    setWorkspaceExecutionError,
    addWorkspaceSnippetHistory,
    showToast,
  ]);

  // Listen to iframe error and log events from HTML mode
  useEffect(() => {
    const handleWindowMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;

      if (event.data.type === 'AXON_IFRAME_LOG') {
        const newLog: ConsoleLog = {
          id: Math.random().toString(),
          type: event.data.level || 'log',
          text: event.data.text || '',
          timestamp: new Date().toLocaleTimeString(),
        };
        setHtmlConsoleLogs((prev) => [...prev.slice(-100), newLog]);
      } else if (event.data.type === 'AXON_IFRAME_ERROR') {
        const errorObj = {
          name: 'RuntimeError',
          message: event.data.message || 'Error occurred in preview document',
          stack: `at ${event.data.filename || 'index.html'}:${event.data.lineno || 1}:${event.data.colno || 1}`,
        };
        const traceback = formatPyDroidTraceback(errorObj, workspaceCode, 'html');
        setWorkspaceExecutionError(traceback);
        setWorkspaceActiveTab('code');
        addChatNotification(
          `⚠️ Code execution failed in HTML Preview (${traceback.errorName}). Full traceback displayed in Code view.`
        );
        showToast('Execution error in preview document');
      }
    };

    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, [workspaceCode, setWorkspaceExecutionError, setWorkspaceActiveTab, addChatNotification, showToast]);

  const handleLoadFromHistory = (item: WorkspaceSnippetHistoryItem) => {
    setWorkspaceCode(item.code);
    let targetMode: WorkspaceMode = 'javascript';
    if (item.language === 'html' || item.code.includes('<html') || item.code.includes('<!DOCTYPE')) {
      targetMode = 'html';
    } else if (item.language === 'json') {
      targetMode = 'json';
    }
    setWorkspaceMode(targetMode);
    setWorkspaceActiveTab('code');
    setWorkspaceExecutionError(null);
    setIsHistoryOpen(false);
    showToast(`Loaded "${item.title}" into Code view`);
  };

  const filteredHistory = useMemo(() => {
    if (!historySearchQuery.trim()) return workspaceSnippetHistory;
    const query = historySearchQuery.toLowerCase();
    return workspaceSnippetHistory.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.language.toLowerCase().includes(query) ||
        item.code.toLowerCase().includes(query)
    );
  }, [workspaceSnippetHistory, historySearchQuery]);

  const handleModeChange = (newMode: WorkspaceMode) => {
    setWorkspaceMode(newMode);
    setWorkspaceExecutionError(null);
    if (newMode === 'html' && !workspaceCode.includes('<html')) {
      setWorkspaceCode(DEFAULT_HTML_CODE);
      addWorkspaceSnippetHistory({
        title: 'HTML Starter Canvas',
        code: DEFAULT_HTML_CODE,
        language: 'html',
        source: 'custom',
      });
    } else if (newMode === 'javascript' && workspaceCode.includes('<!DOCTYPE html>')) {
      setWorkspaceCode(DEFAULT_JS_CODE);
      addWorkspaceSnippetHistory({
        title: 'JavaScript Starter Script',
        code: DEFAULT_JS_CODE,
        language: 'javascript',
        source: 'custom',
      });
    }
  };

  // Build HTML srcDoc with runtime error and console interceptors
  const htmlSrcDoc = useMemo(() => {
    if (workspaceMode !== 'html') return '';
    const scriptInterceptor = `
<script>
  window.addEventListener('error', function(e) {
    try {
      window.parent.postMessage({
        type: 'AXON_IFRAME_ERROR',
        message: e.message,
        filename: e.filename || 'index.html',
        lineno: e.lineno,
        colno: e.colno
      }, '*');
    } catch(err) {}
  });

  (function() {
    ['log', 'info', 'warn', 'error'].forEach(function(lvl) {
      const orig = console[lvl];
      console[lvl] = function() {
        if (orig) orig.apply(console, arguments);
        try {
          const argsArr = Array.prototype.slice.call(arguments);
          const formatted = argsArr.map(function(a) {
            return (typeof a === 'object') ? JSON.stringify(a) : String(a);
          }).join(' ');
          window.parent.postMessage({
            type: 'AXON_IFRAME_LOG',
            level: lvl,
            text: formatted
          }, '*');
        } catch(err) {}
      };
    });
  })();
</script>
`;
    // Inject at start of head or at beginning
    if (workspaceCode.includes('<head>')) {
      return workspaceCode.replace('<head>', '<head>' + scriptInterceptor);
    }
    return scriptInterceptor + workspaceCode;
  }, [workspaceCode, workspaceMode]);

  // Run Code: executes the loaded code and switches to Preview view to show the real result
  // If execution fails, stays in Code view and formats a Python/PyDroid-3 style traceback
  const handleRunCode = useCallback(() => {
    setIsRunning(true);
    setWorkspaceExecutionError(null);
    const startTime = performance.now();
    const timestamp = new Date().toLocaleTimeString();

    // Ensure the executed code is recorded in persistent snippet history
    if (workspaceCode.trim()) {
      const firstLine = workspaceCode.split('\n')[0].replace(/^\/\/\s*|^<!--\s*|^#\s*/, '').trim();
      const snippetTitle = firstLine && firstLine.length < 50 ? firstLine : `Workspace ${workspaceMode.toUpperCase()} Snippet`;
      addWorkspaceSnippetHistory({
        title: snippetTitle,
        code: workspaceCode,
        language: workspaceMode,
        source: 'editor_run',
      });
    }

    if (workspaceMode === 'html') {
      const elapsed = Math.round(performance.now() - startTime);
      setExecutionTimeMs(elapsed);
      setHtmlConsoleLogs([]);
      setIsRunning(false);
      setWorkspaceActiveTab('preview');
      addChatNotification('HTML document built and rendered in Preview.', true);
      showToast('Document rendered in Preview');
      return;
    }

    if (workspaceMode === 'json') {
      try {
        const parsed = JSON.parse(workspaceCode);
        const elapsed = Math.round(performance.now() - startTime);
        setExecutionResult(parsed);
        setExecutionTimeMs(elapsed);
        setLogs((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            type: 'return',
            text: `JSON Validation Passed: Valid data with ${Object.keys(parsed).length} top-level entries.`,
            timestamp,
          },
        ]);
        setWorkspaceActiveTab('preview');
        addChatNotification(`JSON parsed and validated successfully in ${elapsed}ms.`, true);
        showToast(`JSON parsed successfully in ${elapsed}ms`);
      } catch (err: any) {
        const traceback = formatPyDroidTraceback(err, workspaceCode, 'json');
        setWorkspaceExecutionError(traceback);
        setWorkspaceActiveTab('code');
        addChatNotification(
          `⚠️ Code execution failed: ${traceback.errorName}. Full traceback displayed in Code view.`
        );
        showToast('JSON validation error');
      } finally {
        setIsRunning(false);
      }
      return;
    }

    // JavaScript Mode Execution
    try {
      const capturedLogs: ConsoleLog[] = [];
      const customConsole = {
        log: (...args: any[]) => {
          capturedLogs.push({
            id: Math.random().toString(),
            type: 'log',
            text: args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '),
            timestamp: new Date().toLocaleTimeString(),
          });
        },
        info: (...args: any[]) => {
          capturedLogs.push({
            id: Math.random().toString(),
            type: 'info',
            text: args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '),
            timestamp: new Date().toLocaleTimeString(),
          });
        },
        warn: (...args: any[]) => {
          capturedLogs.push({
            id: Math.random().toString(),
            type: 'warn',
            text: args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '),
            timestamp: new Date().toLocaleTimeString(),
          });
        },
        error: (...args: any[]) => {
          capturedLogs.push({
            id: Math.random().toString(),
            type: 'error',
            text: args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '),
            timestamp: new Date().toLocaleTimeString(),
          });
        },
      };

      // Wrap and execute code inside Function sandbox
      // eslint-disable-next-line no-new-func
      const runner = new Function('console', workspaceCode);
      const result = runner(customConsole);
      const elapsed = Math.round(performance.now() - startTime);

      setExecutionResult(result);
      setExecutionTimeMs(elapsed);

      setLogs((prev) => [
        ...prev,
        ...capturedLogs,
        {
          id: Math.random().toString(),
          type: 'return',
          text: `[Evaluation Result (${elapsed}ms)]:\n${
            result === undefined
              ? 'undefined'
              : typeof result === 'object'
              ? JSON.stringify(result, null, 2)
              : String(result)
          }`,
          timestamp,
        },
      ]);

      setWorkspaceActiveTab('preview');
      addChatNotification(`Script executed successfully in ${elapsed}ms. Results ready in Preview.`, true);
      showToast(`Executed in ${elapsed}ms`);
    } catch (err: any) {
      // Format Python / PyDroid-3 style readable traceback
      const traceback = formatPyDroidTraceback(err, workspaceCode, 'javascript');
      setWorkspaceExecutionError(traceback);
      setWorkspaceActiveTab('code');

      // Briefly notify chat of execution failure, detailed error lives in Code view
      addChatNotification(
        `⚠️ Code execution failed: ${traceback.errorName}. Full traceback displayed in Code view.`
      );
      showToast(`Execution error: ${traceback.errorName}`);
    } finally {
      setIsRunning(false);
    }
  }, [
    workspaceCode,
    workspaceMode,
    setWorkspaceActiveTab,
    setWorkspaceExecutionError,
    addChatNotification,
    showToast,
  ]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(workspaceCode);
    setIsCopied(true);
    showToast('Code copied to clipboard');
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSaveToScripts = () => {
    saveScript({
      title: `Workspace Script (${workspaceMode.toUpperCase()})`,
      code: workspaceCode,
      language: workspaceMode,
      description: `Saved from AXON Workspace on ${new Date().toLocaleDateString()}`,
    });
    showToast('Script saved to AXON Library');
  };

  // Keyboard shortcut: Tab indents, Ctrl+Enter / Cmd+Enter runs code
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newCode = workspaceCode.substring(0, start) + '  ' + workspaceCode.substring(end);
      setWorkspaceCode(newCode);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRunCode();
    }
  };

  // Interactive PyDroid-3 style REPL evaluation in the Preview view
  const handleReplSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replInput.trim()) return;

    const cmd = replInput.trim();
    const timestamp = new Date().toLocaleTimeString();

    setLogs((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        type: 'log',
        text: `>>> ${cmd}`,
        timestamp,
      },
    ]);

    try {
      // Evaluate command in client environment
      // eslint-disable-next-line no-eval
      const res = window.eval(cmd);
      setLogs((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          type: 'return',
          text: typeof res === 'object' ? JSON.stringify(res, null, 2) : String(res),
          timestamp,
        },
      ]);
    } catch (err: any) {
      setLogs((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          type: 'error',
          text: `${err?.name || 'Error'}: ${err?.message || err}`,
          timestamp,
        },
      ]);
    }

    setReplInput('');
  };

  // Auto-scroll logs when in preview
  useEffect(() => {
    if (activeTab === 'preview') {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, activeTab]);

  const lineCount = workspaceCode.split('\n').length;
  const byteSize = new Blob([workspaceCode]).size;

  return (
    <div
      id="workspace-pane"
      style={{ touchAction: 'pan-y' }}
      className="flex flex-col h-full min-h-0 w-full bg-neutral-950 text-white select-text border-l border-neutral-900 overflow-hidden"
    >
      {/* Unified Workspace Header (Exactly Two Views: Code and Preview) */}
      <div className="h-11 bg-neutral-900/90 border-b border-neutral-800 px-3 flex items-center justify-between shrink-0 select-none">
        {/* Left: Tab selection - Code and Preview only */}
        <div className="flex items-center gap-1.5">
          <button
            id="workspace-tab-code"
            type="button"
            onClick={() => handleTabChange('code')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'code'
                ? 'bg-neutral-800 text-white border border-neutral-700 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5 text-sky-400" />
            <span className="font-mono">
              {workspaceMode === 'javascript' ? 'script.js' : workspaceMode === 'html' ? 'index.html' : 'data.json'}
            </span>
            {workspaceExecutionError && (
              <span
                className="w-2 h-2 rounded-full bg-red-400 shrink-0 animate-pulse"
                title="Execution error in Code view"
              />
            )}
          </button>

          <button
            id="workspace-tab-preview"
            type="button"
            onClick={() => handleTabChange('preview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'preview'
                ? 'bg-neutral-800 text-white border border-neutral-700 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-emerald-400" />
            <span>Preview</span>
            {executionResult !== null && !workspaceExecutionError && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            )}
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5">
          {/* Language Selector */}
          <select
            value={workspaceMode}
            onChange={(e) => handleModeChange(e.target.value as WorkspaceMode)}
            className="text-[11px] bg-neutral-900 border border-neutral-800 text-neutral-300 rounded-lg px-2 py-1 focus:outline-none"
            title="Language syntax"
          >
            <option value="javascript">JS / TS</option>
            <option value="html">HTML / Web</option>
            <option value="json">JSON</option>
          </select>

          {/* Snippet History Button */}
          <button
            id="workspace-history-btn"
            type="button"
            onClick={() => setIsHistoryOpen(true)}
            title="Workspace Snippet History"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors flex items-center gap-1"
          >
            <History className="w-3.5 h-3.5" />
            {workspaceSnippetHistory.length > 0 && (
              <span className="px-1.5 py-0.2 text-[9px] rounded-full bg-neutral-800 border border-neutral-700 text-neutral-300 font-mono">
                {workspaceSnippetHistory.length}
              </span>
            )}
          </button>

          {/* Copy Button */}
          <button
            id="workspace-copy-btn"
            type="button"
            onClick={handleCopyCode}
            aria-label="Copy code"
            title="Copy code"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Save Button */}
          <button
            type="button"
            onClick={handleSaveToScripts}
            aria-label="Save to library"
            title="Save script to Library"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors hidden sm:inline-flex"
          >
            <Save className="w-3.5 h-3.5" />
          </button>

          {/* Prominent Run Code Button */}
          <button
            id="workspace-run-btn"
            type="button"
            onClick={handleRunCode}
            disabled={isRunning}
            aria-label="Run code"
            title="Execute script (Ctrl+Enter)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black hover:bg-neutral-200 text-xs font-semibold active:scale-95 transition-all shadow-sm shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-black" />
            <span>Run Code</span>
          </button>
        </div>
      </div>

      {/* Main Content Area: Exactly Two Views reachable by Swipe or Tab */}
      <div className="flex-1 min-h-0 bg-black overflow-hidden relative">
        <SwipeableTabContainer<'code' | 'preview'>
          tabs={['code', 'preview'] as const}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          fitHeight={true}
          className="h-full min-h-0"
        >
          {/* ========================================================================= */}
          {/* VIEW 1: CODE VIEW (Shows code currently loaded + AXON Code unification) */}
          {/* ========================================================================= */}
          <div className="h-full min-h-0 flex flex-col p-3 space-y-2 overflow-hidden">
            <div className="flex-1 min-h-0 flex flex-col rounded-xl bg-neutral-950 border border-neutral-800/80 overflow-hidden shadow-sm">
              {/* Code View Sub-bar */}
              <div className="flex select-none text-neutral-400 px-3 py-2 bg-neutral-900/60 border-b border-neutral-800/80 justify-between items-center text-[11px] shrink-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-neutral-300 uppercase text-[10px] bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-700">
                    {workspaceMode}
                  </span>
                  <span>UTF-8</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-neutral-500 font-mono">
                  <span>{lineCount} lines</span>
                  <span>{byteSize} B</span>
                  <span className="hidden sm:inline">Ctrl+Enter to Run</span>
                </div>
              </div>

              {/* Code Textarea Editor */}
              <div className="flex-1 min-h-0 relative flex overflow-hidden">
                <textarea
                  ref={textareaRef}
                  value={workspaceCode}
                  onChange={(e) => setWorkspaceCode(e.target.value)}
                  onKeyDown={handleKeyDown}
                  spellCheck={false}
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="w-full h-full p-3 font-mono text-xs sm:text-[13px] bg-transparent text-neutral-200 focus:outline-none resize-none leading-relaxed selection:bg-neutral-800"
                  placeholder="Write or paste your code here..."
                />
              </div>
            </div>

            {/* Python / PyDroid-3 Style Error Traceback Output (Displayed in Code View) */}
            {workspaceExecutionError && (
              <div
                id="workspace-traceback-panel"
                className="shrink-0 max-h-52 rounded-xl bg-[#0e0707] border border-red-900/70 p-3 space-y-2 shadow-lg overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-150"
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-red-900/40">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="text-xs font-semibold text-red-300 font-mono">
                      {workspaceExecutionError.errorName}
                    </span>
                    {workspaceExecutionError.lineNumber && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-950 border border-red-800/80 text-red-300 font-mono">
                        Line {workspaceExecutionError.lineNumber}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(workspaceExecutionError.fullTraceback);
                        showToast('Traceback copied to clipboard');
                      }}
                      className="px-2 py-0.5 rounded text-[10px] bg-red-950/60 hover:bg-red-900/50 text-red-300 border border-red-800/60 transition-colors"
                      title="Copy full error traceback"
                    >
                      Copy Traceback
                    </button>
                    <button
                      type="button"
                      onClick={() => setWorkspaceExecutionError(null)}
                      className="p-1 rounded text-neutral-400 hover:text-white hover:bg-red-950/60 transition-colors"
                      title="Dismiss error panel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* PyDroid-3 Style Traceback Text */}
                <pre className="font-mono text-xs text-red-200/90 whitespace-pre-wrap leading-relaxed select-text bg-black/40 p-2.5 rounded-lg border border-red-950">
                  {workspaceExecutionError.fullTraceback}
                </pre>

                <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-0.5">
                  <span className="text-[10px] text-neutral-500">
                    Fix the error in the editor above and press "Run Code" again.
                  </span>
                  <button
                    type="button"
                    onClick={handleRunCode}
                    className="px-2.5 py-1 rounded-lg bg-red-900/40 hover:bg-red-900/60 text-red-200 text-xs font-medium transition-colors flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Re-try Run</span>
                  </button>
                </div>
              </div>
            )}

            {/* Persistent Code History: list of every snippet loaded into Code view, most recent first, reloadable on tap */}
            <div
              id="workspace-persistent-code-history"
              className="shrink-0 rounded-xl bg-neutral-950 border border-neutral-800/80 overflow-hidden shadow-xs flex flex-col transition-all"
            >
              {/* History Bar Header */}
              <div
                onClick={toggleInlineHistory}
                className="flex items-center justify-between px-3 py-2 bg-neutral-900/60 border-b border-neutral-800/80 cursor-pointer hover:bg-neutral-900/90 transition-colors select-none"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <History className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="text-xs font-semibold text-neutral-200">Code History</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-300 font-mono shrink-0">
                    {workspaceSnippetHistory.length}
                  </span>
                  <span className="text-[10px] text-neutral-500 hidden sm:inline truncate">
                    • Most recent first • Tap snippet to reload
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSnapshotCurrent();
                    }}
                    className="px-2 py-0.5 rounded text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 transition-colors"
                    title="Snapshot current editor code to history"
                  >
                    Snapshot
                  </button>
                  <div className="flex items-center gap-1 text-[10px] text-neutral-400 pl-1">
                    <span>{showInlineHistory ? 'Collapse' : 'Expand'}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-neutral-400 transition-transform duration-200 ${
                        showInlineHistory ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Snippet List (most recent first, reloadable on tap) */}
              {showInlineHistory && (
                <div className="max-h-44 sm:max-h-52 overflow-y-auto divide-y divide-neutral-900/80 p-1.5 space-y-1">
                  {workspaceSnippetHistory.length === 0 ? (
                    <div className="p-3 text-center text-neutral-500 text-xs">
                      No code snippets in history yet. Generated or loaded code will automatically appear here.
                    </div>
                  ) : (
                    workspaceSnippetHistory.map((item) => {
                      const isActive = workspaceCode.trim() === item.code.trim();
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleLoadFromHistory(item)}
                          className={`w-full text-left p-2 rounded-lg flex items-center justify-between gap-2.5 transition-all cursor-pointer group ${
                            isActive
                              ? 'bg-neutral-900 border border-neutral-700/80 shadow-xs'
                              : 'hover:bg-neutral-900/60 border border-transparent hover:border-neutral-800'
                          }`}
                          title={`Tap to load "${item.title}" into Code view`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`text-xs font-semibold truncate ${
                                  isActive ? 'text-white' : 'text-neutral-300 group-hover:text-white'
                                }`}
                              >
                                {item.title}
                              </span>
                              <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-neutral-800 border border-neutral-700 text-neutral-300">
                                {item.language}
                              </span>
                              {isActive && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-800/70 font-mono flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  Active
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-neutral-500 font-mono">
                              <span>{item.timestamp}</span>
                              <span>•</span>
                              <span>{item.lineCount || item.code.split('\n').length} lines</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLoadFromHistory(item);
                              }}
                              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all shadow-xs ${
                                isActive
                                  ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                                  : 'bg-white text-black hover:bg-neutral-200'
                              }`}
                              title="Re-load snippet into active Code view"
                            >
                              {isActive ? 'Loaded' : 'Tap to Load'}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteWorkspaceSnippetHistoryItem(item.id);
                                showToast('Snippet removed from history');
                              }}
                              className="p-1 rounded text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors opacity-0 group-hover:opacity-100"
                              title="Delete snippet"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* VIEW 2: PREVIEW VIEW (PyDroid-3 / Google AI Studio style live output)    */}
          {/* ========================================================================= */}
          <div className="h-full min-h-0 flex flex-col p-3">
            <div className="flex-1 min-h-0 flex flex-col rounded-xl bg-neutral-950 border border-neutral-800/80 overflow-hidden shadow-sm">
              {/* Preview Header Bar */}
              <div className="h-9 px-3 bg-neutral-900/60 border-b border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400 shrink-0 select-none">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white text-xs">
                    {workspaceMode === 'html' ? 'Web Canvas' : 'Output Console'}
                  </span>
                  {executionTimeMs !== null && (
                    <span className="text-[10px] text-neutral-500 font-mono">
                      [Finished in {executionTimeMs}ms]
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Viewport toggle for HTML */}
                  {workspaceMode === 'html' && (
                    <div className="flex items-center gap-1 p-0.5 bg-neutral-950 rounded-lg border border-neutral-800">
                      <button
                        type="button"
                        onClick={() => setViewportSize('desktop')}
                        className={`p-1 rounded ${
                          viewportSize === 'desktop' ? 'bg-neutral-800 text-white' : 'text-neutral-500'
                        }`}
                        title="Desktop width (100%)"
                      >
                        <Monitor className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewportSize('tablet')}
                        className={`p-1 rounded ${
                          viewportSize === 'tablet' ? 'bg-neutral-800 text-white' : 'text-neutral-500'
                        }`}
                        title="Tablet width (768px)"
                      >
                        <Tablet className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewportSize('mobile')}
                        className={`p-1 rounded ${
                          viewportSize === 'mobile' ? 'bg-neutral-800 text-white' : 'text-neutral-500'
                        }`}
                        title="Mobile width (375px)"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Re-run button */}
                  <button
                    type="button"
                    onClick={handleRunCode}
                    className="flex items-center gap-1 text-[11px] text-neutral-300 hover:text-white px-2 py-1 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 transition-colors"
                    title="Re-execute code"
                  >
                    <RotateCcw className="w-3 h-3 text-emerald-400" />
                    <span>Run Again</span>
                  </button>

                  {/* Back to Code View */}
                  <button
                    type="button"
                    onClick={() => setWorkspaceActiveTab('code')}
                    className="flex items-center gap-1 text-[11px] text-neutral-300 hover:text-white px-2 py-1 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 transition-colors"
                    title="Return to code editor"
                  >
                    <Code className="w-3 h-3 text-sky-400" />
                    <span className="hidden sm:inline">Edit Code</span>
                  </button>
                </div>
              </div>

              {/* Viewport Canvas Body */}
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-black relative">
                {/* HTML Mode Live Preview Canvas */}
                {workspaceMode === 'html' ? (
                  <div className="flex-1 min-h-0 flex flex-col">
                    <div className="flex-1 min-h-0 overflow-auto flex items-center justify-center p-2 bg-neutral-950">
                      <div
                        className="h-full bg-white rounded-lg overflow-hidden transition-all duration-300 shadow-md border border-neutral-800"
                        style={{
                          width:
                            viewportSize === 'mobile'
                              ? '375px'
                              : viewportSize === 'tablet'
                              ? '768px'
                              : '100%',
                          maxWidth: '100%',
                        }}
                      >
                        <iframe
                          ref={iframeRef}
                          srcDoc={htmlSrcDoc}
                          title="AXON Workspace Live Preview"
                          sandbox="allow-scripts allow-modals"
                          className="w-full h-full border-0 bg-transparent"
                        />
                      </div>
                    </div>

                    {/* Collapsible HTML Live Console Drawer */}
                    <div className="shrink-0 border-t border-neutral-800 bg-neutral-950">
                      <button
                        type="button"
                        onClick={() => setIsHtmlConsoleOpen(!isHtmlConsoleOpen)}
                        className="w-full h-7 px-3 flex items-center justify-between text-[11px] text-neutral-400 hover:text-neutral-200 bg-neutral-900/60"
                      >
                        <span className="flex items-center gap-1.5 font-mono">
                          <span>Live Console Logs</span>
                          <span className="text-[10px] px-1 rounded bg-neutral-800 text-neutral-400">
                            {htmlConsoleLogs.length}
                          </span>
                        </span>
                        {isHtmlConsoleOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                      </button>

                      {isHtmlConsoleOpen && (
                        <div className="h-36 overflow-y-auto p-2.5 font-mono text-[11px] space-y-1 bg-black">
                          {htmlConsoleLogs.length === 0 ? (
                            <p className="text-neutral-600 italic">No console logs emitted by document.</p>
                          ) : (
                            htmlConsoleLogs.map((l) => (
                              <div
                                key={l.id}
                                className={`flex gap-2 ${
                                  l.type === 'error'
                                    ? 'text-red-400'
                                    : l.type === 'warn'
                                    ? 'text-amber-400'
                                    : 'text-neutral-300'
                                }`}
                              >
                                <span className="text-neutral-600 shrink-0 select-none">[{l.timestamp}]</span>
                                <span className="flex-1 whitespace-pre-wrap break-all">{l.text}</span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : executionResult !== null || logs.length > 1 ? (
                  /* JS / JSON Mode: PyDroid-3 / Google AI Studio Execution Output Window */
                  <div className="flex-1 min-h-0 flex flex-col font-mono text-xs overflow-hidden">
                    {/* Process Status Header */}
                    <div className="px-3 py-1.5 bg-neutral-900/40 border-b border-neutral-800/60 flex items-center justify-between text-[11px] select-none shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="text-neutral-300 font-semibold">
                          Process finished with exit code 0
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setLogs([]);
                          showToast('Output cleared');
                        }}
                        className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors"
                        title="Clear output"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Terminal Stdout Stream */}
                    <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1.5 leading-relaxed bg-[#09090b]">
                      <div className="text-[10px] text-neutral-500 border-b border-neutral-800/80 pb-1.5 mb-2">
                        [AXON Sandbox Engine - PyDroid-3 / Google AI Studio Runner]
                      </div>

                      {logs.map((log) => {
                        const isError = log.type === 'error';
                        const isReturn = log.type === 'return';
                        const isWarn = log.type === 'warn';

                        return (
                          <div
                            key={log.id}
                            className={`text-[11px] flex gap-2 ${
                              isError
                                ? 'text-red-400 bg-red-950/20 px-1.5 py-0.5 rounded border border-red-900/30'
                                : isReturn
                                ? 'text-emerald-400 bg-emerald-950/10 px-2 py-1 rounded border border-emerald-900/30'
                                : isWarn
                                ? 'text-amber-400'
                                : 'text-neutral-200'
                            }`}
                          >
                            <span className="text-neutral-600 select-none text-[10px] shrink-0 font-mono">
                              [{log.timestamp}]
                            </span>
                            <span className="flex-1 whitespace-pre-wrap break-all">{log.text}</span>
                          </div>
                        );
                      })}
                      <div ref={logsEndRef} />
                    </div>

                    {/* Interactive REPL Expression Evaluator (PyDroid-3 Style) */}
                    <form
                      onSubmit={handleReplSubmit}
                      className="p-2 border-t border-neutral-800/80 bg-neutral-900/60 flex items-center gap-2 shrink-0"
                    >
                      <span className="text-emerald-400 font-bold select-none text-xs">&gt;&gt;&gt;</span>
                      <input
                        type="text"
                        value={replInput}
                        onChange={(e) => setReplInput(e.target.value)}
                        placeholder="Evaluate expression (e.g. 2 + 2, Date.now(), result)..."
                        className="flex-1 bg-transparent text-white text-[11px] focus:outline-none placeholder-neutral-600 font-mono"
                      />
                      <button
                        type="submit"
                        className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-mono transition-colors"
                      >
                        Eval
                      </button>
                    </form>
                  </div>
                ) : (
                  /* Clean PyDroid-3 Style "Ready for Execution" View */
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mx-auto text-neutral-300 shadow-sm">
                      <Play className="w-5 h-5 ml-0.5 fill-current" />
                    </div>
                    <div className="max-w-xs">
                      <h4 className="text-xs font-semibold text-white">Ready for Execution</h4>
                      <p className="text-[11px] text-neutral-400 mt-1">
                        Tap "Run Code" or press Ctrl+Enter to execute the loaded script and view output here.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRunCode}
                      className="px-4 py-1.5 rounded-xl bg-white text-black text-xs font-semibold hover:bg-neutral-200 transition-colors inline-flex items-center gap-1.5 shadow-sm"
                    >
                      <Play className="w-3.5 h-3.5 fill-black" />
                      <span>Execute Script</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </SwipeableTabContainer>
      </div>

      {/* Footer Info Bar */}
      <div className="h-7 bg-neutral-950 border-t border-neutral-900 px-3 flex items-center justify-between text-[10px] text-neutral-500 select-none shrink-0">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>AXON Workspace • Code &amp; Preview</span>
        </span>
        <span className="font-mono text-neutral-600">Swipe or tab to switch</span>
      </div>

      {/* Workspace Snippet History Drawer */}
      {isHistoryOpen && (
        <div
          id="workspace-history-modal"
          className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xs flex justify-end animate-in fade-in duration-150"
        >
          <div className="w-full sm:max-w-md h-full bg-neutral-950 border-l border-neutral-800 flex flex-col shadow-2xl">
            {/* Header */}
            <div className="p-3 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-semibold text-white">Code History</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-300 font-mono">
                  {workspaceSnippetHistory.length}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {workspaceSnippetHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Clear all workspace snippet history?')) {
                        clearWorkspaceSnippetHistory();
                        showToast('Workspace history cleared');
                      }
                    }}
                    className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded-lg transition-colors text-[10px] flex items-center gap-1"
                    title="Clear all history"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline">Clear</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsHistoryOpen(false)}
                  className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
                  title="Close history"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="p-2.5 border-b border-neutral-800/80 bg-neutral-900/40">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  placeholder="Search snippets by title, lang, or code..."
                  className="w-full pl-8 pr-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600"
                />
              </div>
            </div>

            {/* Snippet List */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5">
              {filteredHistory.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-center p-4 text-neutral-500">
                  <History className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-xs font-medium text-neutral-400">No snippets recorded</p>
                  <p className="text-[11px] text-neutral-500 mt-1 max-w-xs">
                    Every generated snippet automatically appears here.
                  </p>
                </div>
              ) : (
                filteredHistory.map((item) => (
                  <div
                    key={item.id}
                    className="group border border-neutral-800 hover:border-neutral-700 rounded-xl bg-neutral-900/60 p-2.5 flex flex-col gap-2 transition-all hover:bg-neutral-900"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-neutral-200 truncate">
                            {item.title}
                          </span>
                          <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-neutral-800 border border-neutral-700 text-neutral-400">
                            {item.language}
                          </span>
                        </div>
                        <span className="text-[10px] text-neutral-500 font-mono mt-0.5 block">
                          {item.timestamp}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleLoadFromHistory(item)}
                          className="px-2.5 py-1 rounded bg-white text-black text-[11px] font-semibold hover:bg-neutral-200 transition-colors shadow-xs"
                          title="Load into Workspace Code view"
                        >
                          Load
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            deleteWorkspaceSnippetHistoryItem(item.id);
                            showToast('Snippet removed from history');
                          }}
                          className="p-1 rounded text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors"
                          title="Delete snippet"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Code preview snippet */}
                    <pre className="p-2 rounded-lg bg-black/60 border border-neutral-800 text-[10px] text-neutral-400 font-mono overflow-x-hidden line-clamp-3">
                      {item.code.split('\n').slice(0, 4).join('\n')}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
