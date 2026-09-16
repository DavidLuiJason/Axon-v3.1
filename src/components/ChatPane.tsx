import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Mic,
  MicOff,
  ArrowUp,
  Trash2,
  Paperclip,
  X,
  ChevronDown,
  AlertTriangle,
  Copy,
  Check,
  Folder,
  BookmarkPlus,
  Download,
  FileText,
  Volume2,
  VolumeX,
  ArrowDown,
  Sparkles,
  Share2,
  LayoutGrid,
  ArrowLeft,
  Image as ImageIcon,
  Eye,
  Square,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ChatAttachment } from '../types';
import { AxonLogo } from './AxonLogo';
import { ModelSelectorModal } from './ModelSelectorModal';
import { ChatShortcutBar } from './ChatShortcutBar';
import { ImageViewerModal } from './ImageViewerModal';
import { isAccountInCooldown, getRemainingCooldownString } from '../lib/aiConfig';
import { resolveMessageButtonColor, getContrastRatio, getLuminance } from '../lib/colorContrast';
import { normalizeMarkdown, stripMarkdown } from '../lib/markdownUtils';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

const ChatMarkdown: React.FC<{ content: string; isAxon: boolean; onImageClick?: (url: string, alt?: string) => void }> = React.memo(({ content, isAxon, onImageClick }) => {
  const normalized = React.useMemo(() => normalizeMarkdown(content), [content]);

  return (
    <div className="chat-markdown break-words text-sm leading-relaxed text-inherit">
      <ReactMarkdown
        remarkPlugins={[remarkBreaks, remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          del: ({ children }) => <del className="line-through opacity-75">{children}</del>,
          img: ({ src, alt }) => (
            <img
              src={src}
              alt={alt}
              onClick={() => src && onImageClick?.(src, alt)}
              className="max-h-64 rounded-xl my-2 cursor-zoom-in border border-black/10 dark:border-white/10 hover:opacity-90 transition-opacity"
            />
          ),
          h1: ({ children }) => <h1 className="text-base font-bold mb-1.5 mt-2.5 first:mt-0 leading-snug">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-bold mb-1 mt-2 first:mt-0 leading-snug">{children}</h2>,
          h3: ({ children }) => <h3 className="text-xs font-bold mb-1 mt-1.5 first:mt-0 tracking-wide uppercase opacity-90">{children}</h3>,
          h4: ({ children }) => <h4 className="text-xs font-bold mb-1 mt-1 first:mt-0">{children}</h4>,
          ul: ({ children }) => <ul className="list-disc list-outside pl-4 mb-2 last:mb-0 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-outside pl-4 mb-2 last:mb-0 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed pl-0.5">{children}</li>,
          code: ({ children, ...props }) => (
            <code
              className={`px-1.5 py-0.5 rounded text-xs font-mono font-medium ${
                isAxon
                  ? 'bg-white/10 text-sky-300 border border-white/15'
                  : 'bg-black/10 text-neutral-900 border border-black/15'
              }`}
              {...props}
            >
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre
              className={`p-2.5 my-2 rounded-lg text-xs font-mono overflow-x-auto border [&>code]:bg-transparent [&>code]:p-0 [&>code]:border-0 [&>code]:text-inherit ${
                isAxon
                  ? 'bg-neutral-950 text-neutral-200 border-neutral-800'
                  : 'bg-neutral-100 text-neutral-900 border-neutral-200'
              }`}
            >
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote
              className={`border-l-2 pl-3 my-2 italic ${
                isAxon ? 'border-neutral-700 text-neutral-300' : 'border-neutral-400 text-neutral-700'
              }`}
            >
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`underline underline-offset-2 hover:opacity-80 transition-opacity ${
                isAxon ? 'text-sky-400' : 'text-blue-600'
              }`}
            >
              {children}
            </a>
          ),
          hr: () => (
            <hr className={`my-2 border-t ${isAxon ? 'border-neutral-800' : 'border-neutral-200'}`} />
          ),
          table: ({ children }) => (
            <div className={`my-2 overflow-x-auto rounded-lg border text-xs ${
              isAxon ? 'border-neutral-800 bg-neutral-950/60' : 'border-neutral-200 bg-white/60'
            }`}>
              <table className="w-full text-left border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className={isAxon ? 'bg-neutral-900/80 border-b border-neutral-800' : 'bg-neutral-100 border-b border-neutral-200'}>
              {children}
            </thead>
          ),
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => (
            <tr className={isAxon ? 'border-b border-neutral-800 last:border-b-0' : 'border-b border-neutral-200 last:border-b-0'}>
              {children}
            </tr>
          ),
          th: ({ children }) => <th className="px-3 py-1.5 font-semibold text-xs">{children}</th>,
          td: ({ children }) => <td className="px-3 py-1.5 text-xs">{children}</td>,
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
});

export const ChatPane: React.FC = () => {
  const {
    activeProjectMessages,
    activeProject,
    addMessage,
    deleteMessage,
    clearMessages,
    icons,
    availableModels,
    activeModelId,
    aiAccounts,
    isGeneratingResponse,
    taskQueue,
    cancelCurrentTask,
    clearTaskQueue,
    showToast,
    extractConversationToNote,
    extractSingleMessageToNote,
    exportConversationToFile,
    theme,
    setPaneViewState,
    setWorkspaceActiveTab,
    currentScreen,
    navigateTo,
    liveThinkingStatus,
    openPanel,
    closePanel,
    isPanelOpen,
  } = useApp();

  const [inputVal, setInputVal] = useState('');
  const [selectedImage, setSelectedImage] = useState<{ url: string; name?: string } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [sharedMessageId, setSharedMessageId] = useState<string | null>(null);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  // Central Navigation & Panel State Integration
  const isModelModalOpen = isPanelOpen('chat-model-selector');
  const isShortcutBarOpen = isPanelOpen('chat-shortcuts');
  const isExtractMenuOpen = isPanelOpen('chat-export') || isPanelOpen('chat-export-pdf');
  const isPdfSubmenuOpen = isPanelOpen('chat-export-pdf');
  const [isExtractingNote, setIsExtractingNote] = useState(false);
  const extractMenuRef = useRef<HTMLDivElement>(null);

  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isFarFromBottom = scrollHeight - scrollTop - clientHeight > 140;
    setShowScrollToBottom(isFarFromBottom);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollToBottom(false);
  };

  const currentModel = availableModels.find((m) => m.id === activeModelId) || availableModels[0];
  const activeAccount = aiAccounts.find(
    (a) => a.provider === currentModel.provider && a.isActive
  );
  const isCooldownActive = isAccountInCooldown(activeAccount);
  const cooldownString = getRemainingCooldownString(activeAccount);

  const functionColors: any = theme.functionColors || {};
  const micRecordingColor = functionColors.micRecordingColor || '#ef4444';

  // Seamless auto-scroll to bottom of messages without stuttering animations
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 160;
    if (isNearBottom || isGeneratingResponse) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [activeProjectMessages, isGeneratingResponse]);

  // Voice recording timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // Close extraction menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (extractMenuRef.current && !extractMenuRef.current.contains(e.target as Node)) {
        if (isExtractMenuOpen) {
          closePanel();
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExtractMenuOpen, closePanel]);

  // Text-to-speech with Claude-styled audio waveform
  const handleToggleSpeak = (msgId: string, text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      showToast('Text-to-speech is not supported on this browser/device');
      return;
    }
    if (speakingMessageId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#`_~[\]()]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.onend = () => setSpeakingMessageId(null);
    utterance.onerror = () => setSpeakingMessageId(null);
    setSpeakingMessageId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const handleSendMessage = () => {
    if (!inputVal.trim() && attachments.length === 0) return;

    addMessage(inputVal.trim(), attachments);

    setInputVal('');
    setAttachments([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleToggleVoice = () => {
    if (!isRecording) {
      setIsRecording(true);
      showToast('Listening... Speak now');
    } else {
      setIsRecording(false);
      if (!inputVal) {
        setInputVal('Draft a responsive component layout with clean monochrome styling');
      }
      showToast('Voice transcribed');
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const processFileForAttachment = (file: File): Promise<ChatAttachment> => {
    return new Promise((resolve) => {
      // Determine accurate MIME type based on file.type or file name extension
      let determinedType = file.type || '';
      if (!determinedType || determinedType === 'application/octet-stream') {
        const extMatch = file.name.match(/\.([a-z0-9]+)$/i);
        const ext = extMatch ? extMatch[1].toLowerCase() : '';
        const extMap: Record<string, string> = {
          png: 'image/png',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          webp: 'image/webp',
          gif: 'image/gif',
          svg: 'image/svg+xml',
          bmp: 'image/bmp',
          mp4: 'video/mp4',
          webm: 'video/webm',
          mov: 'video/quicktime',
          mkv: 'video/x-matroska',
          pdf: 'application/pdf',
          json: 'application/json',
          txt: 'text/plain',
          md: 'text/markdown',
          js: 'application/javascript',
          ts: 'application/typescript',
        };
        determinedType = extMap[ext] || file.type || 'application/octet-stream';
      }

      // If not an image or is SVG/GIF (which shouldn't be rasterized), read directly
      if (!determinedType.startsWith('image/') || determinedType.includes('svg') || determinedType.includes('gif')) {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            name: file.name,
            type: determinedType,
            size: `${(file.size / 1024).toFixed(1)} KB`,
            dataUrl: typeof reader.result === 'string' ? reader.result : undefined,
          });
        };
        reader.onerror = () => {
          resolve({
            name: file.name,
            type: determinedType,
            size: `${(file.size / 1024).toFixed(1)} KB`,
          });
        };
        reader.readAsDataURL(file);
        return;
      }

      // Image file: scale down if large to prevent memory exhaustion and payload limits
      const reader = new FileReader();
      reader.onload = (e) => {
        const rawDataUrl = typeof e.target?.result === 'string' ? e.target.result : '';
        if (!rawDataUrl) {
          resolve({
            name: file.name,
            type: file.type,
            size: `${(file.size / 1024).toFixed(1)} KB`,
          });
          return;
        }

        const img = new Image();
        img.onload = () => {
          const MAX_DIM = 1600;
          let { width, height } = img;
          if (width <= MAX_DIM && height <= MAX_DIM && file.size < 800 * 1024) {
            resolve({
              name: file.name,
              type: file.type,
              size: `${(file.size / 1024).toFixed(1)} KB`,
              dataUrl: rawDataUrl,
            });
            return;
          }

          if (width > height) {
            if (width > MAX_DIM) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            }
          } else {
            if (height > MAX_DIM) {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({
              name: file.name,
              type: file.type,
              size: `${(file.size / 1024).toFixed(1)} KB`,
              dataUrl: rawDataUrl,
            });
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const isPng = file.type === 'image/png';
          const mime = isPng && file.size < 1024 * 1024 ? 'image/png' : 'image/jpeg';
          const compressedDataUrl = canvas.toDataURL(mime, 0.85);
          const approxBytes = Math.round((compressedDataUrl.length * 3) / 4);
          resolve({
            name: file.name,
            type: mime,
            size: `${(approxBytes / 1024).toFixed(1)} KB`,
            dataUrl: compressedDataUrl,
          });
        };
        img.onerror = () => {
          resolve({
            name: file.name,
            type: file.type,
            size: `${(file.size / 1024).toFixed(1)} KB`,
            dataUrl: rawDataUrl,
          });
        };
        img.src = rawDataUrl;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from(e.target.files || []);
    if (files.length === 0) return;

    try {
      const processed = await Promise.all(files.map((file) => processFileForAttachment(file)));
      setAttachments((prev) => [...prev, ...processed]);
      showToast(`Attached ${files.length} file${files.length > 1 ? 's' : ''}`);
    } catch (err) {
      console.warn('Attachment processing error:', err);
    } finally {
      e.target.value = '';
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length === 0) return;
    try {
      const processed = await Promise.all(files.map((file) => processFileForAttachment(file)));
      setAttachments((prev) => [...prev, ...processed]);
      showToast(`Attached ${files.length} file${files.length > 1 ? 's' : ''}`);
    } catch (err) {
      console.warn('Drop attachment error:', err);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData?.items || []);
    const fileItems = items.filter((item) => item.kind === 'file');
    if (fileItems.length > 0) {
      const files = fileItems.map((item) => item.getAsFile()).filter(Boolean) as File[];
      if (files.length > 0) {
        try {
          const processed = await Promise.all(files.map((file) => processFileForAttachment(file)));
          setAttachments((prev) => [...prev, ...processed]);
          showToast(`Attached ${files.length} file${files.length > 1 ? 's' : ''}`);
        } catch (err) {
          console.warn('Paste attachment error:', err);
        }
      }
    }
  };

  const handleRemoveAttachment = (indexToRemove: number) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleCopyText = async (msgId: string, text: string) => {
    try {
      const cleanText = stripMarkdown(text);
      await navigator.clipboard.writeText(cleanText);
      setCopiedMessageId(msgId);
      showToast('Copied message to clipboard');
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch {
      showToast('Failed to copy');
    }
  };

  const handleShareMessage = async (msgId: string, text: string, isAi: boolean) => {
    const senderLabel = isAi ? 'AXON' : 'User';
    const cleanText = stripMarkdown(text);
    const shareData = {
      title: `${senderLabel} message from AXON`,
      text: cleanText,
    };

    if (navigator.share && typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData);
        setSharedMessageId(msgId);
        showToast('Shared message');
        setTimeout(() => setSharedMessageId(null), 2000);
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(cleanText);
      setSharedMessageId(msgId);
      showToast('Message copied to clipboard to share');
      setTimeout(() => setSharedMessageId(null), 2000);
    } catch {
      showToast('Unable to share message');
    }
  };

  const handleSaveFullConversation = () => {
    setIsExtractingNote(true);
    closePanel();
    setTimeout(() => {
      extractConversationToNote();
      setIsExtractingNote(false);
    }, 150);
  };

  return (
    <div
      id="chat-pane"
      className="flex flex-col h-full min-h-0 w-full bg-black text-white relative overflow-hidden"
    >
      {/* Top Chat Bar (Fixed at top of chat pane - never moves, scrolls, or repositions) */}
      <div
        id="chat-top-bar"
        className="h-11 border-b border-neutral-800/80 px-3.5 flex items-center justify-between bg-neutral-950/90 backdrop-blur-sm shrink-0 z-10 select-none"
      >
        {/* Model Selector Pill */}
        <button
          id="chat-model-selector-btn"
          type="button"
          onClick={() => openPanel('chat-model-selector')}
          className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 active:scale-95 transition-all text-xs font-medium text-neutral-200"
        >
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isCooldownActive ? 'bg-amber-400' : 'bg-white'
              }`}
            />
            <span className="font-semibold text-white">
              {aiAccounts.length === 0
                ? 'AXON Core'
                : activeAccount
                ? currentModel.name
                : 'AXON Core'}
            </span>
            {activeAccount && (
              <span className="text-[10px] text-neutral-400 hidden sm:inline">
                ({activeAccount.label})
              </span>
            )}
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
        </button>

        {/* Action icons: Save to library note, Export, Clear messages */}
        <div className="flex items-center gap-1">
          {/* Save / Export Chat action menu */}
          <div className="relative" ref={extractMenuRef}>
            <button
              id="chat-extract-menu-btn"
              type="button"
              onClick={() => {
                if (activeProjectMessages.length === 0) {
                  showToast('No messages in active chat to export. Send a message first.');
                  return;
                }
                if (isExtractMenuOpen) {
                  closePanel();
                } else {
                  openPanel('chat-export');
                }
              }}
              disabled={isExtractingNote}
              aria-label="Save or export conversation"
              title="Save or Export Conversation"
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 active:scale-95 transition-all text-xs font-medium"
            >
              <Download className="w-3.5 h-3.5 text-white" />
              <span className="hidden sm:inline">Save / Export</span>
            </button>

            {isExtractMenuOpen && (
              <div
                id="chat-extract-dropdown"
                className="absolute right-0 top-9 w-64 bg-neutral-950 border border-neutral-800 rounded-xl shadow-2xl p-1.5 z-50 text-xs space-y-1 animate-in fade-in zoom-in-95 duration-150"
              >
                {!isPdfSubmenuOpen ? (
                  <>
                    <div className="px-2 py-1 text-[10px] uppercase font-semibold text-neutral-400 tracking-wider flex items-center justify-between">
                      <span>Save & Export Chat</span>
                      <span className="text-[10px] text-neutral-500 font-mono">
                        {activeProjectMessages.length} msg{activeProjectMessages.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        closePanel();
                        handleSaveFullConversation();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-neutral-900 text-left text-neutral-200 hover:text-white transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5 text-white shrink-0" />
                      <div>
                        <div className="font-medium">Save to Notes</div>
                        <div className="text-[10px] text-neutral-400">Save full chat with synthesized summary</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        closePanel();
                        exportConversationToFile('markdown');
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-neutral-900 text-left text-neutral-200 hover:text-white transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-neutral-300 shrink-0" />
                      <div>
                        <div className="font-medium">Export as Markdown (.md)</div>
                        <div className="text-[10px] text-neutral-400">Complete formatted dialogue</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        closePanel();
                        exportConversationToFile('text');
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-neutral-900 text-left text-neutral-200 hover:text-white transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-neutral-300 shrink-0" />
                      <div>
                        <div className="font-medium">Export as Plain Text (.txt)</div>
                        <div className="text-[10px] text-neutral-400">Simple unformatted transcript</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        closePanel();
                        exportConversationToFile('json');
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-neutral-900 text-left text-neutral-200 hover:text-white transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-neutral-300 shrink-0" />
                      <div>
                        <div className="font-medium">Export as JSON (.json)</div>
                        <div className="text-[10px] text-neutral-400">Raw structured data backup</div>
                      </div>
                    </button>

                    <button
                      id="export-chat-pdf-btn"
                      type="button"
                      onClick={() => {
                        openPanel('chat-export-pdf');
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-neutral-900 text-left text-neutral-200 hover:text-white transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-neutral-300 shrink-0" />
                      <div>
                        <div className="font-medium">Export as PDF (.pdf)</div>
                        <div className="text-[10px] text-neutral-400">Choose Image or Text format</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        closePanel();
                        const transcript = activeProjectMessages
                          .map((m) => `${m.sender === 'user' ? 'User' : 'AXON'}: ${stripMarkdown(m.text)}`)
                          .join('\n\n');
                        navigator.clipboard.writeText(transcript);
                        showToast('Copied conversation to clipboard');
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-neutral-900 text-left text-neutral-200 hover:text-white transition-colors border-t border-neutral-900"
                    >
                      <Copy className="w-3.5 h-3.5 text-neutral-300 shrink-0" />
                      <div>
                        <div className="font-medium">Copy Full Transcript</div>
                        <div className="text-[10px] text-neutral-400">Copy text to clipboard directly</div>
                      </div>
                    </button>
                  </>
                ) : (
                  <div className="p-1 space-y-1.5 animate-in fade-in duration-150">
                    <div className="flex items-center gap-1.5 pb-2 mb-1 border-b border-neutral-800 text-neutral-300">
                      <button
                        type="button"
                        onClick={() => closePanel('chat-export-pdf')}
                        className="p-1 rounded-md hover:bg-neutral-850 text-neutral-400 hover:text-white transition-colors"
                        title="Back to export options"
                        aria-label="Back"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-semibold text-xs text-white">Choose PDF Format</span>
                    </div>

                    <button
                      id="export-pdf-image-btn"
                      type="button"
                      onClick={() => {
                        closePanel();
                        exportConversationToFile('image-pdf');
                      }}
                      className="w-full flex items-start gap-2.5 p-2 rounded-lg hover:bg-neutral-900 text-left text-neutral-200 hover:text-white transition-colors border border-neutral-800/70 hover:border-neutral-700 bg-neutral-900/30"
                    >
                      <div className="p-1.5 rounded-md bg-neutral-800 text-white shrink-0 mt-0.5">
                        <ImageIcon className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="font-medium text-white text-xs">Image PDF</div>
                        <div className="text-[10px] text-neutral-400 leading-tight mt-0.5">
                          Complete visual image capture of the entire conversation from first message to last
                        </div>
                      </div>
                    </button>

                    <button
                      id="export-pdf-text-btn"
                      type="button"
                      onClick={() => {
                        closePanel();
                        exportConversationToFile('pdf');
                      }}
                      className="w-full flex items-start gap-2.5 p-2 rounded-lg hover:bg-neutral-900 text-left text-neutral-200 hover:text-white transition-colors border border-neutral-800/70 hover:border-neutral-700 bg-neutral-900/30"
                    >
                      <div className="p-1.5 rounded-md bg-neutral-800 text-white shrink-0 mt-0.5">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="font-medium text-white text-xs">Text PDF</div>
                        <div className="text-[10px] text-neutral-400 leading-tight mt-0.5">
                          Formatted text transcript exported as a PDF
                        </div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Clear Messages */}
          {activeProjectMessages.length > 0 && (
            <button
              id="chat-clear-btn"
              type="button"
              onClick={clearMessages}
              aria-label="Clear chat messages"
              title="Clear messages in this project"
              className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-neutral-900 active:scale-95 transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Message Stream (Freely scrollable / movable messages) */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        id="chat-messages-scroll"
        className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 select-text overscroll-contain relative"
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
      >
        {activeProjectMessages.length === 0 ? (
          <div
            id="chat-empty-state"
            className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 space-y-4"
          >
            <div
              className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center border shadow-lg"
              style={{
                borderColor: `${activeProject.color || '#ffffff'}40`,
                backgroundColor: `${activeProject.color || '#ffffff'}15`,
              }}
            >
              <Folder className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Workspace: {activeProject.name}
              </h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto mt-1">
                {activeProject.description || 'All messages and memories here are isolated to this project.'}
              </p>
            </div>

            {/* Quick Prompt Starter Suggestions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md pt-2">
              {[
                { label: 'Brainstorm ideas', prompt: 'Brainstorm 3 innovative features for this project' },
                { label: 'Write component', prompt: 'Create a clean, responsive UI component with TypeScript' },
                { label: 'Explain architecture', prompt: 'Explain the core system architecture and state flow' },
                { label: 'Draft notes', prompt: 'Draft a concise project specification and roadmap' },
              ].map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setInputVal(item.prompt)}
                  className="text-left px-3 py-2.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-850 border border-neutral-800 hover:border-neutral-700 text-xs text-neutral-300 hover:text-white transition-all active:scale-95 flex items-center gap-2 group"
                >
                  <Sparkles className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </div>

            <p className="text-[11px] text-neutral-500">
              Type a prompt below or pick a suggestion above to begin.
            </p>
          </div>
        ) : (
          activeProjectMessages.map((msg) => {
            const isAxon = msg.sender === 'axon' || (msg as any).role === 'assistant';
            const isSpeaking = speakingMessageId === msg.id;
            const rawMessageText = typeof msg.text === 'string'
              ? msg.text
              : (msg.text && typeof msg.text === 'object' && 'text' in (msg.text as any)
                  ? String((msg.text as any).text)
                  : JSON.stringify(msg.text || ''));

            // Restrict long code blocks from printing in chat unless explicitly requested
            const hasCodeBlock = /```[a-zA-Z0-9_-]*\n[\s\S]*?```/.test(rawMessageText);
            const showCodeInChat = (msg as any).showFullCodeInChat === true;
            let messageText = rawMessageText;

            if (isAxon && hasCodeBlock && !showCodeInChat) {
              messageText = messageText
                .replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, _lang, code) => {
                  const lines = code.trim().split('\n');
                  if (lines.length <= 3 && code.trim().length <= 100) return match;
                  return '';
                })
                .replace(/(?:here\s+is\s+(?:the\s+)?(?:code|implementation|script|component|file|snippet)[^:\n.]*[:.]?)/gi, '')
                .replace(/(?:below\s+is\s+(?:the\s+)?(?:code|implementation|script|component|file|snippet)[^:\n.]*[:.]?)/gi, '')
                .replace(/(?:i\s+have\s+provided\s+the\s+code\s+(?:below|here)[:.]?)/gi, '')
                .replace(/\n{3,}/g, '\n\n')
                .trim();

              if (!messageText || messageText.length < 5) {
                messageText = 'I have generated the code and loaded it directly into the Workspace.';
              }
            }

            const hasBuildRunResult = Boolean(msg.hasBuildRunResult || (isAxon && hasCodeBlock));

            const bubbleBg = isAxon
              ? functionColors.axonBubbleColor || functionColors.aiChatBubbleBg || '#171717'
              : functionColors.userBubbleColor || functionColors.userChatBubbleBg || '#ffffff';

            const rawBtnColor = isAxon
              ? functionColors.axonMsgBtnColor
              : functionColors.userMsgBtnColor;

            const actionBtnColor = resolveMessageButtonColor(
              rawBtnColor,
              bubbleBg,
              functionColors.messageButtonAutoContrast !== false
            );

            const isBubbleDark = getLuminance(bubbleBg) < 0.45;
            const bubbleTextColor = isAxon
              ? (functionColors.aiChatBubbleText || (isBubbleDark ? '#f5f5f5' : '#171717'))
              : (functionColors.userChatBubbleText || (isBubbleDark ? '#ffffff' : '#0a0a0a'));

            return (
              <div
                key={msg.id}
                id={`chat-message-${msg.id}`}
                className={`flex items-start gap-2.5 group ${
                  isAxon ? 'justify-start' : 'justify-end'
                }`}
              >
                {/* AI Avatar next to AXON's messages */}
                {isAxon && (
                  <div className="shrink-0 mt-0.5">
                    <AxonLogo
                      size={30}
                      preset={icons.avatarType === 'preset' ? icons.avatarPreset : undefined}
                      customUrl={icons.avatarType === 'custom' ? icons.avatarCustomUrl : undefined}
                      glow={false}
                    />
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  style={{
                    backgroundColor: bubbleBg,
                    color: bubbleTextColor,
                  }}
                  className={`relative max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    isAxon
                      ? 'border border-neutral-800 rounded-tl-sm'
                      : 'font-normal rounded-tr-sm shadow-md'
                  }`}
                >
                      {/* Attachments Preview (Single or Multiple) */}
                      {(() => {
                        const messageAttachments = msg.attachments || (msg.attachment ? [msg.attachment] : []);
                        if (messageAttachments.length === 0) return null;
                        return (
                          <div className="mb-2.5 flex flex-col gap-1.5">
                        {messageAttachments.map((att, attIdx) => {
                          const isImage = att.type?.startsWith('image/') || (typeof att.dataUrl === 'string' && att.dataUrl.startsWith('data:image/'));
                          return (
                            <div
                              key={attIdx}
                              onClick={() => {
                                if (isImage && att.dataUrl) {
                                  setSelectedImage({ url: att.dataUrl, name: att.name });
                                }
                              }}
                              className={`p-2 rounded-xl flex items-center gap-2 border text-xs ${
                                isImage && att.dataUrl ? 'cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all' : ''
                              } ${
                                isAxon
                                  ? 'bg-neutral-950 border-neutral-800 text-neutral-300'
                                  : 'bg-neutral-100 border-neutral-200 text-neutral-800'
                              }`}
                            >
                              {isImage && att.dataUrl ? (
                                <div className="relative group/thumb shrink-0">
                                  <img
                                    src={att.dataUrl}
                                    alt={att.name}
                                    className="w-12 h-12 object-cover rounded-lg border border-black/10 dark:border-white/10"
                                  />
                                  <span className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 rounded-lg flex items-center justify-center transition-opacity">
                                    <Eye className="w-3.5 h-3.5 text-white drop-shadow" />
                                  </span>
                                </div>
                              ) : (
                                <span className="p-2 rounded-lg bg-black/5 dark:bg-white/10 shrink-0">
                                  <Paperclip className="w-4 h-4 text-neutral-400" />
                                </span>
                              )}
                              <div className="truncate flex-1 min-w-0">
                                <p className="font-medium truncate flex items-center gap-1">
                                  {att.name}
                                  {isImage && <span className="text-[10px] text-neutral-400 font-normal">(Tap to zoom)</span>}
                                </p>
                                {att.size && (
                                  <p className="text-[10px] opacity-70">{att.size}</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  <ChatMarkdown
                    content={messageText}
                    isAxon={isAxon}
                    onImageClick={(url, alt) => setSelectedImage({ url, name: alt })}
                  />

                  {/* Conditional View Result Button: Only appears right after a code build/run actually happened */}
                  {hasBuildRunResult && (
                    <div className="mt-2.5 pt-2 border-t border-black/10 dark:border-white/10 flex items-center justify-between gap-2">
                      {msg.isResultUnavailable ? (
                        <span className="text-[11px] text-neutral-400 italic">
                          Result no longer available
                        </span>
                      ) : (
                        <button
                          id={`chat-view-result-btn-${msg.id}`}
                          type="button"
                          onClick={() => {
                            setWorkspaceActiveTab('preview');
                            setPaneViewState('workspace-only');
                            if (currentScreen !== 'axon' && currentScreen !== 'code') {
                              navigateTo('code');
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-black hover:bg-neutral-200 active:scale-95 transition-all text-xs font-semibold shadow-xs cursor-pointer"
                          title="Jump to Workspace Preview view"
                        >
                          <Eye className="w-3.5 h-3.5 text-black shrink-0" />
                          <span>View Result</span>
                        </button>
                      )}
                      <span className="text-[10px] text-neutral-400 font-mono">
                        Workspace Preview
                      </span>
                    </div>
                  )}

                  {/* Message Footer: Timestamp & Always-Visible Action Buttons */}
                  <div className="flex items-center justify-between gap-2.5 mt-2 pt-1.5 border-t border-black/10 dark:border-white/10 text-[10px]">
                    <div className="flex items-center gap-1.5 opacity-75 font-mono">
                      <span>{msg.timestamp}</span>
                      {/* Claude-styled dynamic audio waveform when speaking aloud */}
                      {isSpeaking && (
                        <div
                          className="flex items-end gap-0.5 h-3 px-1.5 py-0.5 rounded-full bg-current/20"
                          title="Speaking aloud..."
                        >
                          <span className="w-0.5 h-1.5 bg-current rounded-full animate-[pulse_0.4s_ease-in-out_infinite]" />
                          <span className="w-0.5 h-3 bg-current rounded-full animate-[pulse_0.6s_ease-in-out_infinite]" />
                          <span className="w-0.5 h-2 bg-current rounded-full animate-[pulse_0.5s_ease-in-out_infinite]" />
                          <span className="w-0.5 h-3.5 bg-current rounded-full animate-[pulse_0.7s_ease-in-out_infinite]" />
                        </div>
                      )}
                    </div>

                    {/* Always visible action buttons with customized contrast-safe coloring */}
                    <div className="flex items-center gap-1 opacity-100">
                      {/* Speech audio read aloud toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleSpeak(msg.id, messageText)}
                        title={isSpeaking ? 'Stop speaking' : 'Read aloud'}
                        aria-label={isSpeaking ? 'Stop speaking' : 'Read message aloud'}
                        style={{ color: actionBtnColor, borderColor: `${actionBtnColor}40` }}
                        className="p-1 rounded-md border bg-black/5 hover:bg-black/15 dark:bg-white/10 dark:hover:bg-white/20 transition-all active:scale-95 flex items-center justify-center shadow-xs"
                      >
                        {isSpeaking ? (
                          <VolumeX className="w-3.5 h-3.5" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Copy text */}
                      <button
                        type="button"
                        onClick={() => handleCopyText(msg.id, messageText)}
                        title="Copy text"
                        aria-label="Copy message text"
                        style={{ color: actionBtnColor, borderColor: `${actionBtnColor}40` }}
                        className="p-1 rounded-md border bg-black/5 hover:bg-black/15 dark:bg-white/10 dark:hover:bg-white/20 transition-all active:scale-95 flex items-center justify-center shadow-xs"
                      >
                        {copiedMessageId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Share button replaces delete and save to workspace for both chats */}
                      <button
                        type="button"
                        onClick={() => handleShareMessage(msg.id, messageText, isAxon)}
                        title="Share message"
                        aria-label="Share message"
                        style={{ color: actionBtnColor, borderColor: `${actionBtnColor}40` }}
                        className="p-1 rounded-md border bg-black/5 hover:bg-black/15 dark:bg-white/10 dark:hover:bg-white/20 transition-all active:scale-95 flex items-center justify-center shadow-xs"
                      >
                        {sharedMessageId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Share2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Dynamic Thinking / Generating Indicator with concise activity status */}
        {isGeneratingResponse && (
          <div className="flex items-start gap-2.5 animate-in fade-in duration-150">
            <div className="shrink-0 mt-0.5">
              <AxonLogo
                size={30}
                preset={icons.avatarType === 'preset' ? icons.avatarPreset : undefined}
                customUrl={icons.avatarType === 'custom' ? icons.avatarCustomUrl : undefined}
                glow={true}
              />
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl rounded-tl-sm px-3.5 py-2 flex items-center justify-between gap-3 text-xs text-white">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" />
                </div>
                <span className="font-mono text-xs text-neutral-200">
                  {liveThinkingStatus || 'Thinking...'}
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Scroll-to-Bottom Button when user scrolls up (ChatGPT pattern) */}
      {showScrollToBottom && (
        <button
          id="chat-scroll-bottom-btn"
          type="button"
          onClick={scrollToBottom}
          aria-label="Scroll to bottom"
          title="Scroll to latest messages"
          className="absolute bottom-24 right-4 z-30 p-2.5 rounded-full bg-neutral-900/90 text-white border border-neutral-700 shadow-2xl backdrop-blur-md active:scale-95 hover:bg-neutral-800 transition-all flex items-center justify-center animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          <ArrowDown className="w-4 h-4 text-white" />
        </button>
      )}

      {/* Fixed Bottom Input Dock: Pinned at bottom - never moves, scrolls, or repositions with page content */}
      <div
        id="chat-bottom-dock"
        className="shrink-0 flex flex-col z-20 bg-neutral-950/95 border-t border-neutral-800/80"
      >
        {/* Task Queue Banner if pending requests exist */}
        {taskQueue.length > 0 && (
          <div
            id="chat-task-queue-banner"
            className="mx-3 mt-2 p-2 px-3 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between text-xs"
          >
            <div className="flex items-center gap-2 text-neutral-300 min-w-0">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0" />
              <span className="font-semibold text-white shrink-0">
                Queue ({taskQueue.length}):
              </span>
              <span className="text-neutral-400 truncate text-[11px]">
                Next: "{taskQueue[0].text}"
              </span>
            </div>
            <button
              type="button"
              onClick={clearTaskQueue}
              className="px-2 py-0.5 rounded text-[11px] text-neutral-400 hover:text-red-400 hover:bg-neutral-850 transition-colors shrink-0 ml-2"
            >
              Clear
            </button>
          </div>
        )}

        {/* Usage Limit Cooldown Warning Banner if active */}
        {isCooldownActive && (
          <div
            id="chat-cooldown-alert"
            className="mx-3 mt-2 p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/40 flex items-center justify-between text-xs"
          >
            <div className="flex items-center gap-2 text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                {activeAccount?.label} reached API limit ({cooldownString}). AXON will not auto-switch.
              </span>
            </div>
            <button
              type="button"
              onClick={() => openPanel('chat-model-selector')}
              className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 text-[11px] font-semibold transition-colors shrink-0"
            >
              Switch Account
            </button>
          </div>
        )}

        {/* Voice Recording Banner if active */}
        {isRecording && (
          <div
            id="voice-recording-banner"
            style={{
              borderColor: `${micRecordingColor}66`,
            }}
            className="mx-3 mt-2 p-2.5 rounded-xl bg-neutral-900 border flex items-center justify-between animate-pulse"
          >
            <div
              className="flex items-center gap-2 text-xs"
              style={{ color: micRecordingColor }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full animate-ping"
                style={{ backgroundColor: micRecordingColor }}
              />
              <span className="font-medium">Listening ({recordingSeconds}s)...</span>
            </div>
            <button
              type="button"
              onClick={handleToggleVoice}
              className="text-xs px-2.5 py-1 rounded-lg bg-neutral-800 text-white hover:bg-neutral-700"
            >
              Stop
            </button>
          </div>
        )}

        {/* Attachment Draft Pills if user selected files/images */}
        {attachments.length > 0 && (
          <div
            id="chat-attached-files-container"
            className="mx-3 mt-2 flex flex-wrap gap-1.5 max-h-32 overflow-y-auto"
          >
            {attachments.map((att, idx) => {
              const isImage = att.type?.startsWith('image/') || (typeof att.dataUrl === 'string' && att.dataUrl.startsWith('data:image/'));
              return (
                <div
                  key={idx}
                  id={`chat-attached-file-pill-${idx}`}
                  className="p-1.5 pr-2 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center gap-2 text-xs"
                >
                  {isImage && att.dataUrl ? (
                    <img
                      src={att.dataUrl}
                      alt={att.name}
                      className="w-7 h-7 object-cover rounded-lg border border-neutral-700 shrink-0"
                    />
                  ) : (
                    <span className="p-1.5 rounded-lg bg-neutral-800 text-neutral-300 shrink-0">
                      <Paperclip className="w-3.5 h-3.5" />
                    </span>
                  )}
                  <div className="flex flex-col min-w-0 max-w-[140px]">
                    <span className="truncate text-neutral-200 font-medium text-[11px]">{att.name}</span>
                    {att.size && <span className="text-[9px] text-neutral-500">{att.size}</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(idx)}
                    className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-800 transition-colors"
                    title={`Remove ${att.name}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
            {attachments.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  setAttachments([]);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="self-center px-2 py-1 text-[10px] text-neutral-400 hover:text-neutral-200 rounded-lg bg-neutral-900 border border-neutral-800"
              >
                Clear all ({attachments.length})
              </button>
            )}
          </div>
        )}

        {/* Hidden File Input (supports multiple file selection) */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Slide-up Shortcut Bar directly above the input bar */}
        <ChatShortcutBar
          isOpen={isShortcutBarOpen}
          onClose={() => closePanel('chat-shortcuts')}
          onInsertPrompt={(prompt) =>
            setInputVal((prev) => (prev ? prev + ' ' + prompt : prompt))
          }
        />

        {/* Input Bar at the bottom (Fixed in place, positioned at the very bottom of the screen) */}
        <div
          id="chat-input-bar"
          className="no-swipe-gesture p-3 pb-4 sm:pb-3.5 bg-neutral-950/95 backdrop-blur-sm shrink-0 relative"
          style={{ touchAction: 'manipulation' }}
        >
        <div
          style={{
            backgroundColor: functionColors.chatInputBg || undefined,
          }}
          className="flex items-center gap-2 bg-neutral-900/90 border border-neutral-800 rounded-2xl px-2 py-1.5 focus-within:border-neutral-600 transition-colors"
        >
          {/* Attach / + Button */}
          <button
            id="chat-attach-btn"
            type="button"
            onClick={handleAttachClick}
            aria-label="Attach file or image"
            title="Attach file"
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Text Input */}
          <input
            id="chat-input-field"
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={`Message ${currentModel.name} in ${activeProject.name}...`}
            className="flex-1 bg-transparent text-sm text-white placeholder-neutral-500 focus:outline-none min-w-0 px-1 py-1"
          />

          {/* Shortcut Bar Trigger Button (Immediately left of mic) */}
          <button
            id="chat-shortcut-toggle-btn"
            type="button"
            onClick={() => (isShortcutBarOpen ? closePanel('chat-shortcuts') : openPanel('chat-shortcuts'))}
            aria-label={isShortcutBarOpen ? 'Hide shortcuts' : 'Show quick shortcuts'}
            title={isShortcutBarOpen ? 'Hide Shortcuts' : 'Quick Shortcuts'}
            className={`p-2 rounded-xl transition-all active:scale-95 shrink-0 ${
              isShortcutBarOpen
                ? 'bg-white text-black shadow-md'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>

          {/* Microphone Icon Button */}
          <button
            id="chat-mic-btn"
            type="button"
            onClick={handleToggleVoice}
            aria-label={isRecording ? 'Mute microphone' : 'Voice input'}
            title={isRecording ? 'Stop Voice' : 'Voice Input'}
            style={{
              backgroundColor: isRecording ? micRecordingColor : undefined,
              color: isRecording
                ? getContrastRatio('#ffffff', micRecordingColor) >= 2
                  ? '#ffffff'
                  : '#000000'
                : undefined,
            }}
            className={`p-2 rounded-xl transition-all active:scale-95 ${
              isRecording
                ? 'shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Distinct Send/Action Button or Stop Button */}
          {isGeneratingResponse && !inputVal.trim() && attachments.length === 0 ? (
            <button
              id="chat-stop-task-btn"
              type="button"
              onClick={cancelCurrentTask}
              aria-label="Stop generation"
              title="Stop current task"
              className="p-2 rounded-xl transition-all flex items-center justify-center shrink-0 bg-white text-black hover:bg-neutral-200 border border-neutral-200 active:scale-95 shadow-md"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          ) : (
            <button
              id="chat-send-btn"
              type="button"
              onClick={handleSendMessage}
              disabled={!inputVal.trim() && attachments.length === 0}
              aria-label={isGeneratingResponse ? 'Queue request' : 'Send message'}
              title={isGeneratingResponse ? 'Queue request' : 'Send message'}
              style={{
                backgroundColor:
                  inputVal.trim() || attachments.length > 0
                    ? functionColors.sendButtonColor || '#ffffff'
                    : undefined,
              }}
              className={`p-2 rounded-xl transition-all flex items-center justify-center shrink-0 ${
                inputVal.trim() || attachments.length > 0
                  ? 'text-black active:scale-95 shadow-md hover:bg-neutral-200'
                  : 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
              }`}
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>

      {/* Model & Account Switching Modal */}
      <ModelSelectorModal
        isOpen={isModelModalOpen}
        onClose={() => closePanel('chat-model-selector')}
      />

      {/* Full-Screen Touch/Zoom Image Viewer Modal */}
      <ImageViewerModal
        isOpen={Boolean(selectedImage)}
        imageUrl={selectedImage?.url || ''}
        imageName={selectedImage?.name}
        onClose={() => setSelectedImage(null)}
      />
    </div>
  );
};
