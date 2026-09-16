import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Zap,
  Check,
  RefreshCw,
  Bell,
  FileCode,
  FileText,
  AlertTriangle,
  Play,
} from 'lucide-react';
import {
  AutomationRule,
  RuleTriggerType,
  RuleActionType,
} from '../../types';
import { parsePlainLanguageRule } from '../../lib/automationEngine';
import { ModalOverlayContainer } from '../ModalOverlayContainer';

interface RuleEditorModalProps {
  isOpen: boolean;
  initialRule?: AutomationRule | null;
  onClose: () => void;
  onSave: (rule: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt' | 'triggerCount'> & { id?: string }) => void;
}

const SAMPLE_PLAIN_PROMPTS = [
  'if a login fails because of a connection issue, retry automatically',
  'if an account hits usage limit, show diagnostic notice',
  'if a prompt asks for code, auto-format with syntax highlighting',
  'if a script fails in runner, save error to notes automatically',
];

export const RuleEditorModal: React.FC<RuleEditorModalProps> = ({
  isOpen,
  initialRule,
  onClose,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<'plain_language' | 'guided_form'>('plain_language');

  // Plain language input
  const [plainPrompt, setPlainPrompt] = useState('');

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<RuleTriggerType>('connection_error');
  const [triggerLabel, setTriggerLabel] = useState('Connection Issue or Network Failure');
  const [triggerCondition, setTriggerCondition] = useState('Connection drops or server unreachable');
  const [actionType, setActionType] = useState<RuleActionType>('retry_automatically');
  const [actionLabel, setActionLabel] = useState('Retry Automatically');
  const [maxRetries, setMaxRetries] = useState<number>(3);
  const [customMessage, setCustomMessage] = useState('');
  const [instructionPayload, setInstructionPayload] = useState('');
  const [enabled, setEnabled] = useState(true);

  // Initialize or reset when modal opens or initialRule changes
  useEffect(() => {
    if (initialRule) {
      setTitle(initialRule.title);
      setDescription(initialRule.description);
      setTriggerType(initialRule.triggerType);
      setTriggerLabel(initialRule.triggerLabel);
      setTriggerCondition(initialRule.triggerCondition);
      setActionType(initialRule.actionType);
      setActionLabel(initialRule.actionLabel);
      setMaxRetries(initialRule.actionConfig.maxRetries || 3);
      setCustomMessage(initialRule.actionConfig.customMessage || '');
      setInstructionPayload(initialRule.actionConfig.instructionPayload || '');
      setEnabled(initialRule.enabled);
      setPlainPrompt(initialRule.plainLanguagePrompt || initialRule.description || '');
      setActiveTab(initialRule.creationMode === 'guided_form' ? 'guided_form' : 'plain_language');
    } else {
      setTitle('');
      setDescription('');
      setTriggerType('connection_error');
      setTriggerLabel('Connection Issue or Network Failure');
      setTriggerCondition('Connection drops or request times out');
      setActionType('retry_automatically');
      setActionLabel('Retry Automatically');
      setMaxRetries(3);
      setCustomMessage('');
      setInstructionPayload('');
      setEnabled(true);
      setPlainPrompt('');
      setActiveTab('plain_language');
    }
  }, [initialRule, isOpen]);

  if (!isOpen) return null;

  // Handle plain language parsing
  const handleApplyPlainLanguage = (text: string) => {
    setPlainPrompt(text);
    if (!text.trim()) return;
    const parsed = parsePlainLanguageRule(text);
    setTitle(parsed.title);
    setDescription(parsed.description);
    setTriggerType(parsed.triggerType);
    setTriggerLabel(parsed.triggerLabel);
    setTriggerCondition(parsed.triggerCondition);
    setActionType(parsed.actionType);
    setActionLabel(parsed.actionLabel);
    if (parsed.actionConfig.maxRetries) setMaxRetries(parsed.actionConfig.maxRetries);
    if (parsed.actionConfig.customMessage) setCustomMessage(parsed.actionConfig.customMessage);
    if (parsed.actionConfig.instructionPayload) setInstructionPayload(parsed.actionConfig.instructionPayload);
  };

  const handleTriggerChange = (type: RuleTriggerType) => {
    setTriggerType(type);
    switch (type) {
      case 'connection_error':
        setTriggerLabel('Connection Issue or Network Failure');
        setTriggerCondition('Connection drops or request times out');
        break;
      case 'rate_limit':
        setTriggerLabel('Usage Limit Reached (HTTP 429)');
        setTriggerCondition('Active account returns 429 Too Many Requests');
        break;
      case 'model_error':
        setTriggerLabel('AI Model Generation Error');
        setTriggerCondition('API returns non-200 status or malformed response');
        break;
      case 'code_execution_error':
        setTriggerLabel('Code Execution Error');
        setTriggerCondition('Script in AXON Code throws an unhandled exception');
        break;
      case 'keyword_match':
        setTriggerLabel('Prompt Keyword Match');
        setTriggerCondition('Prompt contains: code, python, or algorithm');
        break;
      case 'message_sent':
        setTriggerLabel('Every Message Sent');
        setTriggerCondition('User submits any message in chat');
        break;
      default:
        setTriggerLabel('Custom Condition');
        setTriggerCondition('User-specified condition');
        break;
    }
  };

  const handleActionChange = (type: RuleActionType) => {
    setActionType(type);
    switch (type) {
      case 'retry_automatically':
        setActionLabel('Retry Automatically');
        break;
      case 'notify_user':
        setActionLabel('Notify User with Alert');
        break;
      case 'auto_format_code':
        setActionLabel('Auto-Format Code with Syntax Highlighting');
        break;
      case 'save_to_notes':
        setActionLabel('Save Record to Notes');
        break;
      case 'switch_account':
        setActionLabel('Switch to Backup Account');
        break;
      case 'execute_run_code':
        setActionLabel('Execute Run Code Extension');
        break;
      default:
        setActionLabel('Append Behavioral Instruction');
        break;
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const finalTitle = title.trim() || (triggerLabel + ' → ' + actionLabel);
    const finalDesc = description.trim() || plainPrompt.trim() || `When ${triggerCondition}, then ${actionLabel}.`;

    onSave({
      id: initialRule?.id,
      title: finalTitle,
      description: finalDesc,
      enabled,
      triggerType,
      triggerLabel,
      triggerCondition,
      actionType,
      actionLabel,
      actionConfig: {
        maxRetries: actionType === 'retry_automatically' ? maxRetries : undefined,
        customMessage: customMessage || undefined,
        instructionPayload: instructionPayload || undefined,
      },
      plainLanguagePrompt: plainPrompt || undefined,
      creationMode: activeTab,
    });
    onClose();
  };

  return (
    <ModalOverlayContainer
      isOpen={isOpen}
      onClose={onClose}
      id="rule-editor-modal"
      maxWidth="lg"
      ariaLabel={initialRule ? 'Edit Automation Rule' : 'New Automation Rule'}
    >
      {/* Header */}
      <div className="p-4 border-b border-neutral-800/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-white text-black flex items-center justify-center font-bold">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold tracking-tight">
              {initialRule ? 'Edit Automation Rule' : 'New Automation Rule'}
            </h3>
            <p className="text-xs text-neutral-400">
              Define simple conditional triggers ("if this happens, do this")
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="px-4 pt-3 pb-2 border-b border-neutral-900 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('plain_language')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'plain_language'
                ? 'bg-white text-black shadow-sm'
                : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Plain Language</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('guided_form')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'guided_form'
                ? 'bg-white text-black shadow-sm'
                : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Guided Form</span>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSave} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 text-xs">
          {activeTab === 'plain_language' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-neutral-300 font-semibold mb-1">
                  Describe what you want AXON to automate
                </label>
                <p className="text-[11px] text-neutral-500 mb-2">
                  Use standard "if [event], do [action]" sentences. AXON will parse the trigger and configure the action for you.
                </p>
                <textarea
                  id="plain-rule-prompt-input"
                  rows={3}
                  value={plainPrompt}
                  onChange={(e) => handleApplyPlainLanguage(e.target.value)}
                  placeholder='e.g. "if a login fails because of a connection issue, retry automatically"'
                  className="w-full px-3 py-2.5 rounded-xl bg-neutral-900 border border-neutral-700/80 text-white placeholder-neutral-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all text-xs"
                />
              </div>

              {/* Sample Prompts */}
              <div>
                <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                  Quick Starter Examples
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {SAMPLE_PLAIN_PROMPTS.map((prompt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyPlainLanguage(prompt)}
                      className="px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white text-[11px] text-left transition-all"
                    >
                      "{prompt}"
                    </button>
                  ))}
                </div>
              </div>

              {/* Instant Parsed Preview Card */}
              {plainPrompt.trim().length > 0 && (
                <div className="p-3.5 rounded-xl bg-neutral-900/90 border border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-white" />
                      Parsed Rule Structure
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-neutral-800 text-[10px] text-neutral-300 font-mono">
                      Auto-Configured
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-start gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-white text-black font-bold text-[10px] shrink-0">
                        IF
                      </span>
                      <div>
                        <div className="font-semibold text-white">{triggerLabel}</div>
                        <div className="text-[11px] text-neutral-400">{triggerCondition}</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 pt-1 border-t border-neutral-800/80">
                      <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-200 font-bold text-[10px] shrink-0">
                        THEN
                      </span>
                      <div>
                        <div className="font-semibold text-white">{actionLabel}</div>
                        {actionType === 'retry_automatically' && (
                          <div className="text-[11px] text-neutral-400">
                            Auto-retries up to {maxRetries} times with exponential delay
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Guided Step 1: Trigger */}
              <div className="space-y-1.5">
                <label className="block text-neutral-300 font-semibold flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-white text-black flex items-center justify-center font-bold text-[10px]">
                    1
                  </span>
                  When this happens (Trigger Condition)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'connection_error', label: 'Connection / Login Fail', icon: RefreshCw },
                    { id: 'rate_limit', label: 'Usage / Rate Limit (429)', icon: AlertTriangle },
                    { id: 'keyword_match', label: 'Keyword / Code Mention', icon: FileCode },
                    { id: 'code_execution_error', label: 'Script Execution Error', icon: Play },
                    { id: 'model_error', label: 'AI Model API Error', icon: Bell },
                    { id: 'message_sent', label: 'Every Message Sent', icon: FileText },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isSelected = triggerType === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleTriggerChange(item.id as RuleTriggerType)}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                          isSelected
                            ? 'bg-white text-black border-white shadow-md font-semibold'
                            : 'bg-neutral-900/90 text-neutral-300 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/80'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[11px] truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  value={triggerCondition}
                  onChange={(e) => setTriggerCondition(e.target.value)}
                  placeholder="Trigger condition details..."
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder-neutral-500 focus:outline-none focus:border-white text-xs"
                />
              </div>

              {/* Guided Step 2: Action */}
              <div className="space-y-1.5">
                <label className="block text-neutral-300 font-semibold flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-white text-black flex items-center justify-center font-bold text-[10px]">
                    2
                  </span>
                  AXON should do this (Action)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'retry_automatically', label: 'Retry Automatically', icon: RefreshCw },
                    { id: 'auto_format_code', label: 'Auto-Format Code', icon: FileCode },
                    { id: 'notify_user', label: 'Notify User with Alert', icon: Bell },
                    { id: 'save_to_notes', label: 'Save Record to Notes', icon: FileText },
                    { id: 'switch_account', label: 'Switch Backup Account', icon: Zap },
                    { id: 'execute_run_code', label: 'Execute Run Code Hook', icon: Sparkles },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isSelected = actionType === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleActionChange(item.id as RuleActionType)}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                          isSelected
                            ? 'bg-white text-black border-white shadow-md font-semibold'
                            : 'bg-neutral-900/90 text-neutral-300 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/80'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[11px] truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Extra parameters based on action */}
                {actionType === 'retry_automatically' && (
                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-neutral-900 border border-neutral-800">
                    <span className="text-[11px] text-neutral-300 font-medium">Max retry attempts:</span>
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 5].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setMaxRetries(num)}
                          className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                            maxRetries === num
                              ? 'bg-white text-black shadow-sm'
                              : 'bg-neutral-800 text-neutral-400 hover:text-white'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Rule Title & Status */}
          <div className="pt-2 border-t border-neutral-800/80 space-y-3">
            <div>
              <label className="block text-neutral-300 font-semibold mb-1">
                Rule Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={title || 'e.g. Connection Issue Auto-Retry'}
                className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder-neutral-500 focus:outline-none focus:border-white text-xs"
              />
            </div>

            {/* Active Switch */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-900 border border-neutral-800">
              <div>
                <div className="font-semibold text-white">Enable Rule Immediately</div>
                <div className="text-[11px] text-neutral-400">
                  AXON will monitor and apply this rule going forward whenever matched.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEnabled(!enabled)}
                className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-1 ${
                  enabled ? 'bg-white' : 'bg-neutral-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full transition-transform ${
                    enabled ? 'bg-black translate-x-5' : 'bg-neutral-500 translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-neutral-800/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-900 font-medium text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-white text-black font-bold text-xs hover:bg-neutral-200 transition-colors flex items-center gap-1.5 shadow-md active:scale-95"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{initialRule ? 'Save Changes' : 'Save Rule'}</span>
            </button>
          </div>
        </form>
    </ModalOverlayContainer>
  );
};
