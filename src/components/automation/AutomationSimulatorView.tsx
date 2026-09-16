import React, { useState } from 'react';
import {
  Activity,
  Play,
  Zap,
  Code2,
  RefreshCw,
  AlertTriangle,
  FileCode,
  Terminal,
  CheckCircle2,
  Clock,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { executeRunCodeScript } from '../../lib/automationEngine';

interface SimulationLog {
  id: string;
  timestamp: string;
  type: 'rule' | 'runcode' | 'system';
  title: string;
  message: string;
  status: 'success' | 'warning' | 'info';
  durationMs?: number;
}

export const AutomationSimulatorView: React.FC = () => {
  const {
    automationRules,
    runCodeEntries,
    activeModel,
    showToast,
  } = useApp();

  const [logs, setLogs] = useState<SimulationLog[]>([
    {
      id: 'init-1',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      type: 'system',
      title: 'Simulator Engine Ready',
      message: 'Monitoring active conditional rules and sandboxed run-code extensions.',
      status: 'info',
    },
  ]);
  const [isSimulating, setIsSimulating] = useState(false);

  const addLog = (log: Omit<SimulationLog, 'id' | 'timestamp'>) => {
    const newLog: SimulationLog = {
      ...log,
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setLogs((prev) => [newLog, ...prev.slice(0, 49)]);
  };

  const handleSimulateConnectionFail = async () => {
    setIsSimulating(true);
    addLog({
      type: 'system',
      title: 'Simulating Connection Failure',
      message: 'Network socket dropped during model dispatch to /api/ai/chat...',
      status: 'warning',
    });

    await new Promise((r) => setTimeout(r, 600));

    const retryRule = automationRules.find(
      (r) => r.enabled && r.triggerType === 'connection_error' && r.actionType === 'retry_automatically'
    );

    if (retryRule) {
      const maxRetries = retryRule.actionConfig.maxRetries || 3;
      addLog({
        type: 'rule',
        title: `Rule Matched: "${retryRule.title}"`,
        message: `Trigger matched: [${retryRule.triggerLabel}]. Initiating automatic retry sequence (Max ${maxRetries} attempts).`,
        status: 'success',
      });

      await new Promise((r) => setTimeout(r, 500));

      addLog({
        type: 'rule',
        title: 'Auto-Retry Succeeded',
        message: 'Reconnected successfully on attempt 2. Conversation flow preserved without user disruption.',
        status: 'success',
        durationMs: 42.8,
      });
      showToast('Simulation: Connection issue resolved via auto-retry rule');
    } else {
      addLog({
        type: 'rule',
        title: 'No Active Rule Found',
        message: 'No enabled rule configured for "connection_error". Error would be surfaced to chat.',
        status: 'warning',
      });
    }

    setIsSimulating(false);
  };

  const handleSimulateRateLimit = async () => {
    setIsSimulating(true);
    addLog({
      type: 'system',
      title: 'Simulating HTTP 429 Too Many Requests',
      message: 'Provider API returned rate limit header for current active account...',
      status: 'warning',
    });

    await new Promise((r) => setTimeout(r, 600));

    const rateRule = automationRules.find(
      (r) => r.enabled && r.triggerType === 'rate_limit'
    );

    if (rateRule) {
      addLog({
        type: 'rule',
        title: `Rule Triggered: "${rateRule.title}"`,
        message: `Recorded 24-hour safety cooldown in memory. Strict protocol: Auto-switch prevented. Diagnostic card displayed.`,
        status: 'success',
      });
      showToast('Simulation: Rate limit rule triggered diagnostic notice');
    } else {
      addLog({
        type: 'system',
        title: 'Default Rate Limit Handler',
        message: 'Applied standard AXON cooldown timer without custom rule modifier.',
        status: 'info',
      });
    }

    setIsSimulating(false);
  };

  const handleSimulateCustomCommand = async () => {
    setIsSimulating(true);
    const commandEntry = runCodeEntries.find(
      (e) => e.enabled && e.hookPoint === 'custom_command'
    );

    if (!commandEntry) {
      addLog({
        type: 'runcode',
        title: 'No Custom Command Extension',
        message: 'No active Run Code extension found with hookPoint="custom_command". Add one in the Run Code tab.',
        status: 'warning',
      });
      setIsSimulating(false);
      return;
    }

    const keyword = commandEntry.commandKeyword || '/status';
    addLog({
      type: 'system',
      title: `Simulating Slash Command: "${keyword}"`,
      message: `User entered command in chat. Intercepting before network dispatch...`,
      status: 'info',
    });

    await new Promise((r) => setTimeout(r, 400));

    const res = await executeRunCodeScript(commandEntry, `${keyword} test`, {
      activeRulesCount: automationRules.filter((r) => r.enabled).length,
      activeRunCodeCount: runCodeEntries.filter((e) => e.enabled).length,
      userModel: activeModel.name,
    });

    if (res.success) {
      addLog({
        type: 'runcode',
        title: `Executed: "${commandEntry.title}"`,
        message: `Output:\n${res.output}`,
        status: 'success',
        durationMs: res.executionTimeMs,
      });
      showToast(`Simulation: ${keyword} command executed`);
    } else {
      addLog({
        type: 'runcode',
        title: `Script Error: "${commandEntry.title}"`,
        message: res.error || 'Execution threw an error',
        status: 'warning',
      });
    }

    setIsSimulating(false);
  };

  const handleSimulatePostResponse = async () => {
    setIsSimulating(true);
    const postHook = runCodeEntries.find(
      (e) => e.enabled && e.hookPoint === 'post_response'
    );

    if (!postHook) {
      addLog({
        type: 'runcode',
        title: 'No Post-Response Modifier',
        message: 'No active Run Code extension found with hookPoint="post_response". Add one in the Run Code tab.',
        status: 'warning',
      });
      setIsSimulating(false);
      return;
    }

    const sampleAIResponse = 'Here is the step-by-step algorithm to optimize mobile memory allocations.';
    addLog({
      type: 'system',
      title: 'Simulating AI Response Interceptor',
      message: `Incoming model output: "${sampleAIResponse}"`,
      status: 'info',
    });

    await new Promise((r) => setTimeout(r, 400));

    const res = await executeRunCodeScript(postHook, sampleAIResponse, {
      activeRulesCount: automationRules.filter((r) => r.enabled).length,
      activeRunCodeCount: runCodeEntries.filter((e) => e.enabled).length,
      userModel: activeModel.name,
    });

    if (res.success) {
      addLog({
        type: 'runcode',
        title: `Post-Response Modified: "${postHook.title}"`,
        message: `Final transformed output:\n${res.output}`,
        status: 'success',
        durationMs: res.executionTimeMs,
      });
      showToast('Simulation: AI output modified via live script');
    }

    setIsSimulating(false);
  };

  const clearLogs = () => {
    setLogs([
      {
        id: 'reset-1',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        type: 'system',
        title: 'Logs Cleared',
        message: 'Simulator event history reset.',
        status: 'info',
      },
    ]);
  };

  return (
    <div className="space-y-4 text-white">
      {/* Header */}
      <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-white text-black font-bold text-[10px] tracking-wider uppercase">
              Part 5
            </span>
            <h2 className="text-base font-bold tracking-tight">Simulator & Execution Diagnostics</h2>
          </div>
          <p className="text-xs text-neutral-400 mt-1 max-w-xl leading-relaxed">
            Test and observe your conditional rules and Run Code extensions in real time. Simulate connection drops, rate limits, custom commands, and live text transformers.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={clearLogs}
            className="px-3 py-1.5 rounded-xl border border-neutral-800 hover:bg-neutral-800 text-neutral-400 hover:text-white text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear Logs</span>
          </button>
        </div>
      </div>

      {/* Simulator Action Buttons Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        <button
          type="button"
          disabled={isSimulating}
          onClick={handleSimulateConnectionFail}
          className="p-3 rounded-2xl bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 text-left space-y-1.5 transition-all group active:scale-95 disabled:opacity-50"
        >
          <div className="w-7 h-7 rounded-lg bg-neutral-800 group-hover:bg-white group-hover:text-black text-white flex items-center justify-center transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="font-bold text-xs text-white">Connection Drop</div>
            <div className="text-[11px] text-neutral-400">Tests auto-retry rule sequence</div>
          </div>
        </button>

        <button
          type="button"
          disabled={isSimulating}
          onClick={handleSimulateRateLimit}
          className="p-3 rounded-2xl bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 text-left space-y-1.5 transition-all group active:scale-95 disabled:opacity-50"
        >
          <div className="w-7 h-7 rounded-lg bg-neutral-800 group-hover:bg-white group-hover:text-black text-white flex items-center justify-center transition-colors">
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="font-bold text-xs text-white">Rate Limit (429)</div>
            <div className="text-[11px] text-neutral-400">Tests limit notification rule</div>
          </div>
        </button>

        <button
          type="button"
          disabled={isSimulating}
          onClick={handleSimulateCustomCommand}
          className="p-3 rounded-2xl bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 text-left space-y-1.5 transition-all group active:scale-95 disabled:opacity-50"
        >
          <div className="w-7 h-7 rounded-lg bg-neutral-800 group-hover:bg-white group-hover:text-black text-white flex items-center justify-center transition-colors">
            <Terminal className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="font-bold text-xs text-white">Slash Command</div>
            <div className="text-[11px] text-neutral-400">Tests /status interceptor script</div>
          </div>
        </button>

        <button
          type="button"
          disabled={isSimulating}
          onClick={handleSimulatePostResponse}
          className="p-3 rounded-2xl bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 text-left space-y-1.5 transition-all group active:scale-95 disabled:opacity-50"
        >
          <div className="w-7 h-7 rounded-lg bg-neutral-800 group-hover:bg-white group-hover:text-black text-white flex items-center justify-center transition-colors">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="font-bold text-xs text-white">Post-Response Hook</div>
            <div className="text-[11px] text-neutral-400">Tests live output transformation</div>
          </div>
        </button>
      </div>

      {/* Real-time Execution Feed */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950 overflow-hidden">
        <div className="p-3 border-b border-neutral-800/80 bg-neutral-900/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-white" />
            <span className="font-bold text-xs tracking-tight">Execution Stream & Event Log</span>
          </div>
          <span className="text-[11px] font-mono text-neutral-500">
            {logs.length} events recorded
          </span>
        </div>

        <div className="p-3 space-y-2 max-h-[460px] overflow-y-auto">
          {logs.map((log) => {
            const isRule = log.type === 'rule';
            const isRunCode = log.type === 'runcode';

            return (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-neutral-900/70 border border-neutral-800/80 text-xs font-mono space-y-1 animate-in fade-in"
              >
                <div className="flex items-center justify-between text-[10px] text-neutral-400">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        isRule
                          ? 'bg-white text-black'
                          : isRunCode
                          ? 'bg-neutral-800 text-white'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}
                    >
                      {log.type.toUpperCase()}
                    </span>
                    <span className="font-bold text-white">{log.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {log.durationMs !== undefined && (
                      <span className="flex items-center gap-0.5 text-neutral-400">
                        <Clock className="w-2.5 h-2.5" />
                        {log.durationMs.toFixed(1)}ms
                      </span>
                    )}
                    <span>{log.timestamp}</span>
                  </div>
                </div>

                <div className="text-neutral-300 whitespace-pre-wrap leading-relaxed pt-0.5 text-[11px]">
                  {log.message}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
