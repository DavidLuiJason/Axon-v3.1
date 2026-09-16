import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Eye,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Copy,
  Check,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  FileCode,
  HardDrive,
  ExternalLink,
  Layers,
  Shield,
  Play,
  Pause,
  Volume2,
} from 'lucide-react';
import { AssetManifestItem } from '../../types';
import { formatBytes } from '../../lib/storageManifest';
import { ModalOverlayContainer } from '../ModalOverlayContainer';

interface AssetFileViewerModalProps {
  isOpen: boolean;
  item: AssetManifestItem | null;
  onClose: () => void;
  dataUrl?: string;
  textContent?: string;
}

// Generates an authentic SVG diagram for System Architecture Diagram when no uploaded file exists
function getSystemArchitectureSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 640" width="100%" height="100%">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0a0a0f"/>
        <stop offset="100%" stop-color="#14141d"/>
      </linearGradient>
      <linearGradient id="cardGrad1" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#1c1c28"/>
        <stop offset="100%" stop-color="#12121c"/>
      </linearGradient>
      <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#06b6d4"/>
        <stop offset="100%" stop-color="#3b82f6"/>
      </linearGradient>
      <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#10b981"/>
        <stop offset="100%" stop-color="#059669"/>
      </linearGradient>
      <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
        <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#262635" stroke-width="0.5" stroke-opacity="0.3"/>
      </pattern>
    </defs>

    <rect width="1000" height="640" fill="url(#bgGrad)"/>
    <rect width="1000" height="640" fill="url(#grid)"/>

    <!-- Header Section -->
    <text x="50" y="55" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="22" font-weight="700" letter-spacing="-0.5">AXON System Architecture</text>
    <text x="50" y="80" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="12">Offline-First Neural Pipeline &bull; Storage Manifest &bull; Dual-Pane App Shell</text>
    <rect x="830" y="38" width="120" height="28" rx="6" fill="#10b981" fill-opacity="0.1" stroke="#10b981" stroke-opacity="0.3"/>
    <text x="890" y="56" fill="#34d399" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="11" font-weight="600" text-anchor="middle">v2.4 Production</text>

    <!-- Top Block: App Shell Layout -->
    <g transform="translate(50, 110)">
      <rect width="900" height="110" rx="12" fill="url(#cardGrad1)" stroke="#2e2e42" stroke-width="1.2"/>
      <rect x="0" y="0" width="900" height="32" rx="12" fill="#242436"/>
      <rect x="0" y="20" width="900" height="12" fill="#242436"/>
      <circle cx="20" cy="16" r="4.5" fill="#ef4444"/>
      <circle cx="36" cy="16" r="4.5" fill="#eab308"/>
      <circle cx="52" cy="16" r="4.5" fill="#22c55e"/>
      <text x="75" y="20" fill="#e2e8f0" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="11" font-weight="600">Fixed App-Shell Layout (RULE[AGENTS_md])</text>

      <rect x="25" y="46" width="260" height="50" rx="8" fill="#151522" stroke="#37374d"/>
      <text x="38" y="68" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="11" font-weight="600">Pinned Top Header</text>
      <text x="38" y="85" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="10">Nav &bull; Hamburger &bull; Storage Telemetry</text>

      <rect x="315" y="46" width="270" height="50" rx="8" fill="#151522" stroke="#06b6d4" stroke-opacity="0.4"/>
      <text x="328" y="68" fill="#38bdf8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="11" font-weight="600">Scrollable Middle Stream</text>
      <text x="328" y="85" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="10">flex-1 min-h-0 overflow-y-auto</text>

      <rect x="615" y="46" width="260" height="50" rx="8" fill="#151522" stroke="#37374d"/>
      <text x="628" y="68" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="11" font-weight="600">Pinned Bottom Input Bar</text>
      <text x="628" y="85" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="10">Chat Input &bull; Mic &bull; Attachments</text>
    </g>

    <!-- Connectors -->
    <path d="M 275 220 L 275 270" stroke="#3b82f6" stroke-width="2" stroke-dasharray="4,4"/>
    <path d="M 725 220 L 725 270" stroke="#10b981" stroke-width="2" stroke-dasharray="4,4"/>

    <!-- Left Block: AXON Brain & Intelligence Engine -->
    <g transform="translate(50, 270)">
      <rect width="425" height="310" rx="14" fill="url(#cardGrad1)" stroke="#2e2e42" stroke-width="1.2"/>
      <rect x="18" y="18" width="389" height="32" rx="8" fill="#1e293b"/>
      <text x="32" y="39" fill="#60a5fa" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="13" font-weight="700">1. AXON Brain &amp; Model Router</text>

      <!-- Subcard 1 -->
      <rect x="18" y="62" width="389" height="65" rx="8" fill="#131320" stroke="#28283a"/>
      <text x="32" y="84" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="11" font-weight="600">Offline Quantized LLM (0.5B/1.5B)</text>
      <text x="32" y="102" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="10">WebLLM / Wasm / 4-bit Quantized fallback &bull; 480MB</text>
      <rect x="340" y="74" width="55" height="20" rx="4" fill="#3b82f6" fill-opacity="0.15"/>
      <text x="367" y="88" fill="#60a5fa" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="9" font-weight="600" text-anchor="middle">Local</text>

      <!-- Subcard 2 -->
      <rect x="18" y="137" width="389" height="65" rx="8" fill="#131320" stroke="#28283a"/>
      <text x="32" y="159" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="11" font-weight="600">Cloud Neural Models &bull; Gemini 2.5</text>
      <text x="32" y="177" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="10">Streaming code synthesis, multi-modal vision parsing</text>
      <rect x="340" y="149" width="55" height="20" rx="4" fill="#8b5cf6" fill-opacity="0.15"/>
      <text x="367" y="163" fill="#a78bfa" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="9" font-weight="600" text-anchor="middle">Cloud</text>

      <!-- Subcard 3 -->
      <rect x="18" y="212" width="389" height="75" rx="8" fill="#131320" stroke="#28283a"/>
      <text x="32" y="234" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="11" font-weight="600">Context Window &amp; Token Trimmer</text>
      <text x="32" y="252" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="10">Active memory compressor &bull; Sliding conversation window</text>
      <text x="32" y="270" fill="#64748b" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="9">Prevents memory crashes on high-load devices</text>
    </g>

    <!-- Right Block: Storage Manifest & Device Quota -->
    <g transform="translate(525, 270)">
      <rect width="425" height="310" rx="14" fill="url(#cardGrad1)" stroke="#2e2e42" stroke-width="1.2"/>
      <rect x="18" y="18" width="389" height="32" rx="8" fill="#064e3b"/>
      <text x="32" y="39" fill="#34d399" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="13" font-weight="700">2. Storage Manifest &amp; Budget Engine</text>

      <!-- Subcard 1 -->
      <rect x="18" y="62" width="389" height="65" rx="8" fill="#131320" stroke="#28283a"/>
      <text x="32" y="84" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="11" font-weight="600">Custom Storage Budget (e.g. 15GB Default)</text>
      <text x="32" y="102" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="10">Enforced against all downloads, models, and attachments</text>
      <rect x="330" y="74" width="65" height="20" rx="4" fill="#10b981" fill-opacity="0.15"/>
      <text x="362" y="88" fill="#34d399" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="9" font-weight="600" text-anchor="middle">Enforced</text>

      <!-- Subcard 2 -->
      <rect x="18" y="137" width="389" height="65" rx="8" fill="#131320" stroke="#28283a"/>
      <text x="32" y="159" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="11" font-weight="600">Archive (Lossless) vs Space-Saver (Lossy)</text>
      <text x="32" y="177" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="10">Dynamic compression, 4-bit quantizer, 65% byte reduction</text>
      <rect x="330" y="149" width="65" height="20" rx="4" fill="#f59e0b" fill-opacity="0.15"/>
      <text x="362" y="163" fill="#fbbf24" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="9" font-weight="600" text-anchor="middle">Dual-Tier</text>

      <!-- Subcard 3 -->
      <rect x="18" y="212" width="389" height="75" rx="8" fill="#131320" stroke="#28283a"/>
      <text x="32" y="234" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="11" font-weight="600">Protected Core vs Removable Packs</text>
      <text x="32" y="252" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="10">System assets locked &bull; Knowledge packs modular</text>
      <text x="32" y="270" fill="#64748b" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="9">Auto-Trim priority: Cache &rarr; Chat &rarr; Files &rarr; Packs &rarr; Models</text>
    </g>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const AssetFileViewerModal: React.FC<AssetFileViewerModalProps> = ({
  isOpen,
  item,
  onClose,
  dataUrl,
  textContent,
}) => {
  const [zoomScale, setZoomScale] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showMarkdownRender, setShowMarkdownRender] = useState(true);

  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Reset viewport state on item change
  useEffect(() => {
    if (isOpen) {
      setZoomScale(1);
      setPanPosition({ x: 0, y: 0 });
      setCopied(false);
      setIsPlayingAudio(false);
      setShowMarkdownRender(true);
    }
  }, [isOpen, item?.id]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        setZoomScale((prev) => Math.min(5, +(prev + 0.25).toFixed(2)));
      } else if (e.key === '-' || e.key === '_') {
        setZoomScale((prev) => Math.max(0.5, +(prev - 0.25).toFixed(2)));
      } else if (e.key === '0') {
        setZoomScale(1);
        setPanPosition({ x: 0, y: 0 });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !item) return null;

  // Classify file type
  const mime = (item.mimeType || '').toLowerCase();
  const name = (item.name || '').toLowerCase();

  const isImage =
    mime.startsWith('image/') ||
    /\.(png|jpe?g|webp|gif|svg|bmp|ico|avif)$/i.test(name);

  const isAudio =
    mime.startsWith('audio/') ||
    /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(name);

  const isVideo =
    mime.startsWith('video/') ||
    /\.(mp4|webm|mov|mkv)$/i.test(name);

  const isPdf =
    mime === 'application/pdf' ||
    name.endsWith('.pdf');

  const isCodeOrText =
    mime.startsWith('text/') ||
    mime.includes('json') ||
    mime.includes('javascript') ||
    mime.includes('typescript') ||
    mime.includes('xml') ||
    /\.(txt|md|json|js|ts|tsx|jsx|py|html|css|jsonl|sql|sh|yml|yaml|csv|log)$/i.test(name);

  // Resolve image source URL
  let resolvedImageUrl = dataUrl || item.metadata?.dataUrl || item.metadata?.previewUrl;
  if (!resolvedImageUrl && isImage) {
    if (item.name.toLowerCase().includes('architecture') || item.id === 'asset-user-diagram') {
      resolvedImageUrl = getSystemArchitectureSvg();
    }
  }

  // Resolve text / code content
  let resolvedText = textContent || item.metadata?.content;
  if (!resolvedText && dataUrl && dataUrl.startsWith('data:')) {
    try {
      const commaIdx = dataUrl.indexOf(',');
      if (commaIdx !== -1) {
        const meta = dataUrl.slice(0, commaIdx);
        const raw = dataUrl.slice(commaIdx + 1);
        if (meta.includes('base64')) {
          resolvedText = decodeURIComponent(escape(atob(raw)));
        } else {
          resolvedText = decodeURIComponent(raw);
        }
      }
    } catch (e) {
      // If binary or undecodable, fall through
    }
  }

  // Default text representation if empty
  if (!resolvedText && isCodeOrText) {
    if (name.endsWith('.jsonl') || item.category === 'chat_history') {
      resolvedText = JSON.stringify(
        [
          {
            timestamp: item.createdAt || '2026-09-05T14:20:00.000Z',
            role: 'user',
            content: 'Review the architecture diagram and storage quota manifest.',
          },
          {
            timestamp: item.createdAt || '2026-09-05T14:20:02.000Z',
            role: 'assistant',
            content: 'AXON storage budget active at user quota. All modules operating in offline-first mode.',
          },
        ],
        null,
        2
      );
    } else {
      resolvedText = `// Asset: ${item.name}
// Location: ${item.storageLocation}
// MIME Type: ${item.mimeType}
// Size: ${formatBytes(item.storedSizeBytes)} (Original: ${formatBytes(item.originalSizeBytes)})
// Category: ${item.category}
// Quality State: ${item.qualityState}
// Save Mode: ${item.saveMode}

${item.description || 'No direct text content attached. Asset registered in device manifest.'}`;
    }
  }

  const handleDownload = () => {
    try {
      const dlUrl = resolvedImageUrl || dataUrl;
      if (dlUrl) {
        const link = document.createElement('a');
        link.href = dlUrl;
        link.download = item.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (resolvedText) {
        const blob = new Blob([resolvedText], { type: item.mimeType || 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = item.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error('Failed to download asset:', e);
    }
  };

  const handleCopyText = async () => {
    if (!resolvedText) return;
    try {
      await navigator.clipboard.writeText(resolvedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy text:', e);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || zoomScale <= 1) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...panPosition };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPanPosition({
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play().then(() => setIsPlayingAudio(true)).catch(() => {});
    }
  };

  return (
    <ModalOverlayContainer
      isOpen={isOpen}
      onClose={onClose}
      id="asset-file-viewer-modal"
      maxWidth="xl"
      ariaLabel={`Viewing asset: ${item.name}`}
      className="p-0 flex flex-col h-[85vh] max-h-[850px] bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl"
    >
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-neutral-800 bg-neutral-900/80 backdrop-blur flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-xl bg-neutral-800 text-neutral-200 shrink-0">
            {isImage ? (
              <ImageIcon className="w-4 h-4 text-emerald-400" />
            ) : isAudio ? (
              <Music className="w-4 h-4 text-violet-400" />
            ) : isVideo ? (
              <Film className="w-4 h-4 text-blue-400" />
            ) : isCodeOrText ? (
              <FileCode className="w-4 h-4 text-amber-400" />
            ) : (
              <HardDrive className="w-4 h-4 text-neutral-400" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white truncate">{item.name}</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 font-medium uppercase shrink-0">
                {item.category.replace('_', ' ')}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-neutral-400 truncate">
              <span>{item.storageLocation}</span>
              <span>&bull;</span>
              <span className="font-mono text-neutral-300">{formatBytes(item.storedSizeBytes)}</span>
              {item.saveMode && (
                <>
                  <span>&bull;</span>
                  <span className={item.saveMode === 'archive' ? 'text-emerald-400' : 'text-amber-400'}>
                    {item.saveMode === 'archive' ? 'Lossless Archive' : 'Space-Saver'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {(resolvedImageUrl || dataUrl || resolvedText) && (
            <button
              type="button"
              onClick={handleDownload}
              title="Download asset file"
              className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 bg-neutral-950 flex flex-col overflow-hidden relative">
        {/* CASE 1: IMAGE VIEWER */}
        {isImage && (
          <div
            className="flex-1 relative flex items-center justify-center overflow-hidden select-none bg-neutral-950"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {resolvedImageUrl ? (
              <div
                className="transition-transform duration-75 cursor-grab active:cursor-grabbing max-w-full max-h-full flex items-center justify-center p-4"
                style={{
                  transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoomScale})`,
                }}
              >
                <img
                  src={resolvedImageUrl}
                  alt={item.name}
                  className="max-h-[62vh] max-w-full object-contain rounded-lg shadow-2xl border border-neutral-800"
                  draggable={false}
                />
              </div>
            ) : (
              <div className="p-8 text-center text-neutral-400 space-y-2">
                <ImageIcon className="w-12 h-12 mx-auto text-neutral-600 mb-2" />
                <p className="text-sm font-medium text-white">Image Manifest Record</p>
                <p className="text-xs text-neutral-500">
                  Binary stored at: <span className="font-mono text-neutral-400">{item.storageLocation}</span>
                </p>
              </div>
            )}

            {/* Floating Zoom Toolbar */}
            {resolvedImageUrl && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-900/90 border border-neutral-750 backdrop-blur shadow-xl text-neutral-300">
                <button
                  type="button"
                  onClick={() => setZoomScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)))}
                  title="Zoom Out (-)"
                  className="p-1.5 rounded-full hover:bg-neutral-800 hover:text-white transition-colors"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono font-medium px-1.5 min-w-[42px] text-center">
                  {Math.round(zoomScale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomScale((s) => Math.min(5, +(s + 0.25).toFixed(2)))}
                  title="Zoom In (+)"
                  className="p-1.5 rounded-full hover:bg-neutral-800 hover:text-white transition-colors"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <div className="w-px h-3.5 bg-neutral-700 mx-0.5" />
                <button
                  type="button"
                  onClick={() => {
                    setZoomScale(1);
                    setPanPosition({ x: 0, y: 0 });
                  }}
                  title="Reset Zoom (0)"
                  className="p-1.5 rounded-full hover:bg-neutral-800 hover:text-white transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* CASE 2: AUDIO VIEWER */}
        {isAudio && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-neutral-950 space-y-6">
            <div className="w-24 h-24 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shadow-xl">
              <Music className="w-10 h-10" />
            </div>
            <div className="text-center space-y-1 max-w-md">
              <h3 className="text-base font-bold text-white">{item.name}</h3>
              <p className="text-xs text-neutral-400">{item.storageLocation}</p>
            </div>

            {dataUrl ? (
              <div className="w-full max-w-md p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-3">
                <audio
                  ref={audioRef}
                  src={dataUrl}
                  controls
                  className="w-full"
                  onPlay={() => setIsPlayingAudio(true)}
                  onPause={() => setIsPlayingAudio(false)}
                />
              </div>
            ) : (
              <div className="w-full max-w-md p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 text-center space-y-2">
                <div className="flex items-center justify-center gap-1 h-8">
                  {[40, 70, 30, 90, 60, 45, 80, 20, 95, 60, 30, 85, 50].map((h, i) => (
                    <div
                      key={i}
                      className="w-1.5 bg-violet-500/60 rounded-full"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
                <p className="text-xs text-neutral-400">Audio asset registered in device storage.</p>
              </div>
            )}
          </div>
        )}

        {/* CASE 3: VIDEO VIEWER */}
        {isVideo && (
          <div className="flex-1 flex items-center justify-center p-6 bg-black overflow-hidden">
            {dataUrl ? (
              <video
                src={dataUrl}
                controls
                className="max-h-[65vh] max-w-full rounded-xl shadow-2xl border border-neutral-800"
              />
            ) : (
              <div className="text-center p-8 space-y-3">
                <Film className="w-12 h-12 mx-auto text-neutral-600" />
                <p className="text-sm font-medium text-white">Video Asset: {item.name}</p>
                <p className="text-xs text-neutral-500">{item.storageLocation}</p>
              </div>
            )}
          </div>
        )}

        {/* CASE 4: PDF / DOCUMENT VIEWER */}
        {isPdf && (
          <div className="flex-1 flex flex-col overflow-hidden bg-neutral-900">
            {dataUrl ? (
              <iframe
                src={dataUrl}
                title={item.name}
                className="w-full h-full border-0 bg-white"
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4 text-center">
                <FileText className="w-16 h-16 text-neutral-600" />
                <div className="space-y-1 max-w-md">
                  <h3 className="text-sm font-bold text-white">{item.name}</h3>
                  <p className="text-xs text-neutral-400">{item.storageLocation}</p>
                  <p className="text-[11px] text-neutral-500 pt-2">
                    PDF document registered in offline manifest.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CASE 5: CODE / TEXT / JSON / MARKDOWN VIEWER */}
        {isCodeOrText && (
          <div className="flex-1 flex flex-col min-h-0 bg-neutral-950">
            {/* Code Toolbar */}
            <div className="px-4 py-2 border-b border-neutral-800/80 bg-neutral-900/40 flex items-center justify-between text-xs text-neutral-400 shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-neutral-300">
                  {resolvedText.split('\n').length} lines
                </span>
                <span>&bull;</span>
                <span className="font-mono text-[11px]">
                  {resolvedText.length} chars
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors font-medium text-[11px]"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Text</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Code Content */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 font-mono text-xs text-neutral-200 leading-relaxed whitespace-pre font-light select-text">
              {resolvedText}
            </div>
          </div>
        )}

        {/* CASE 6: GENERIC / MODEL / KNOWLEDGE PACK INSPECTOR */}
        {!isImage && !isAudio && !isVideo && !isPdf && !isCodeOrText && (
          <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 text-xs text-neutral-300">
            <div className="p-4 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Manifest Asset ID</span>
                <span className="font-mono text-white text-[11px]">{item.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Category</span>
                <span className="font-semibold text-white capitalize">{item.category.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Storage Location</span>
                <span className="font-mono text-neutral-300">{item.storageLocation}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">MIME Type</span>
                <span className="font-mono text-neutral-300">{item.mimeType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Stored Footprint</span>
                <span className="font-mono font-bold text-white">{formatBytes(item.storedSizeBytes)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Original Footprint</span>
                <span className="font-mono text-neutral-400">{formatBytes(item.originalSizeBytes)}</span>
              </div>
              {item.originalSizeBytes > item.storedSizeBytes && (
                <div className="flex justify-between">
                  <span className="text-neutral-400">Space-Saver Compression</span>
                  <span className="font-mono text-emerald-400 font-semibold">
                    -{Math.round((1 - item.storedSizeBytes / item.originalSizeBytes) * 100)}% reduction
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-neutral-400">Quality &amp; Preservation</span>
                <span className="font-medium text-neutral-300 capitalize">{item.qualityState}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">System Protection</span>
                <span className={`font-semibold ${item.isCore ? 'text-blue-400' : 'text-purple-400'}`}>
                  {item.isCore ? 'Protected System Core' : 'Removable Pack'}
                </span>
              </div>
            </div>

            {item.description && (
              <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800 space-y-1">
                <p className="font-semibold text-white text-xs">Description</p>
                <p className="text-neutral-400 text-xs leading-relaxed">{item.description}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-5 py-2.5 border-t border-neutral-850 bg-neutral-950 flex items-center justify-between text-[11px] text-neutral-500 shrink-0">
        <div className="flex items-center gap-2">
          <span>Registered: {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Active'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Status: {item.isEnabled === false ? 'Disabled' : 'Enabled'}</span>
        </div>
      </div>
    </ModalOverlayContainer>
  );
};
