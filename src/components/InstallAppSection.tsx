import React, { useState, useEffect, useMemo } from 'react';
import {
  Smartphone,
  Download,
  DownloadCloud,
  Share2,
  PlusSquare,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Globe,
  Info,
  HardDrive,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatBytes, getDeviceAwarePresets } from '../lib/storageManifest';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface Window {
    __axon_deferred_prompt?: BeforeInstallPromptEvent | null;
  }
}

interface InstallAppSectionProps {
  showToast?: (message: string) => void;
}

export const InstallAppSection: React.FC<InstallAppSectionProps> = ({ showToast }) => {
  const { storageBudget, setStorageBudgetBytes, deviceStorageEstimate } = useApp();
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [customGb, setCustomGb] = useState<string>('');
  const presets = useMemo(() => getDeviceAwarePresets(deviceStorageEstimate), [deviceStorageEstimate]);
  const isPresetActive = presets.some((p) => p.bytes === storageBudget.budgetBytes);

  useEffect(() => {
    const isPreset = presets.some((p) => p.bytes === storageBudget.budgetBytes);
    if (!isPreset && storageBudget.budgetBytes > 0) {
      const gb = (storageBudget.budgetBytes / (1024 * 1024 * 1024)).toFixed(1).replace(/\.0$/, '');
      setCustomGb(gb);
    }
  }, []);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    typeof window !== 'undefined' ? window.__axon_deferred_prompt || null : null
  );
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isIframe, setIsIframe] = useState<boolean>(false);

  // Platform and Browser Detection for PWA install paths
  const [platform, setPlatform] = useState<'android' | 'ios' | 'desktop'>('desktop');
  const [isSafari, setIsSafari] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect if inside an iframe (like AI Studio preview)
    try {
      setIsIframe(window.self !== window.top);
    } catch {
      setIsIframe(true);
    }

    const ua = navigator.userAgent || '';
    const isIOSDevice =
      /iPhone|iPad|iPod/i.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroidDevice = /Android/i.test(ua);

    if (isIOSDevice) {
      setPlatform('ios');
    } else if (isAndroidDevice) {
      setPlatform('android');
    } else {
      setPlatform('desktop');
    }

    // Check if Safari on iOS
    const isSafariBrowser =
      /Safari/i.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/i.test(ua);
    setIsSafari(isSafariBrowser);

    // Check if running in standalone display mode
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandaloneMode) {
      setIsInstalled(true);
    }

    // Capture beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      window.__axon_deferred_prompt = promptEvent;
      setDeferredPrompt(promptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      window.__axon_deferred_prompt = null;
      if (showToast) showToast('AXON successfully installed!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [showToast]);

  // Handle native PWA install prompt trigger
  const handleTriggerPwaInstall = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
          setDeferredPrompt(null);
          window.__axon_deferred_prompt = null;
          if (showToast) showToast('Installation accepted!');
        } else {
          if (showToast) showToast('Install prompt dismissed');
        }
      } catch (err) {
        console.error('PWA install error:', err);
        if (showToast) showToast('Unable to launch installer');
      }
    } else if (isIframe) {
      // In an iframe preview, beforeinstallprompt cannot trigger; provide 1-click new tab action
      window.open(window.location.href, '_blank');
      if (showToast) showToast('Opening in direct browser tab for installation');
    }
  };

  return (
    <div
      id="settings-install-app-card"
      className="rounded-2xl bg-neutral-900/40 border border-neutral-800/80 p-5 space-y-4"
    >
      {/* Header & Main Control */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-neutral-800/80 text-neutral-300">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">Install App</h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700/60">
                {platform === 'android'
                  ? 'Android'
                  : platform === 'ios'
                  ? 'iOS'
                  : 'Desktop'}
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Add AXON to home screen for fullscreen standalone access
            </p>
          </div>
        </div>

        {isInstalled ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs font-semibold shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Installed</span>
          </div>
        ) : deferredPrompt ? (
          <button
            id="install-app-direct-btn"
            type="button"
            onClick={handleTriggerPwaInstall}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-semibold transition-colors shrink-0"
          >
            <DownloadCloud className="w-3.5 h-3.5" />
            <span>Install App</span>
          </button>
        ) : (
          <button
            id="toggle-install-options-btn"
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-semibold transition-colors shrink-0"
          >
            <span>Install App</span>
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>

      {/* Expanded PWA Direct Installation Details */}
      {isExpanded && (
        <div className="space-y-3.5 pt-1">
          {/* Status Banner if Already Installed */}
          {isInstalled ? (
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex items-center gap-2.5 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <div>
                <p className="font-semibold text-emerald-200">Already Installed</p>
                <p className="text-[11px] text-emerald-400/90">
                  AXON is installed and running in standalone display mode on this device.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-neutral-950/70 border border-neutral-800/80 space-y-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-semibold text-white">
                      Progressive Web App (PWA)
                    </h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-950/50 text-blue-300 border border-blue-800/50">
                      iOS & Android
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Installs AXON directly to your home screen with zero browser UI, launching full-screen like a native application with offline caching.
                  </p>
                </div>
              </div>

              {/* ANDROID FLOW */}
              {platform === 'android' && (
                <div className="space-y-3">
                  {deferredPrompt ? (
                    <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-750 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-white">
                          Chrome Native Installer Ready
                        </p>
                        <p className="text-[11px] text-neutral-400">
                          Tap to trigger the native Android install prompt.
                        </p>
                      </div>
                      <button
                        id="pwa-trigger-install-btn"
                        type="button"
                        onClick={handleTriggerPwaInstall}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-colors shrink-0"
                      >
                        <DownloadCloud className="w-4 h-4" />
                        <span>Install to Android Home</span>
                      </button>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800/80 space-y-2.5">
                      <div className="flex items-center gap-2 text-xs font-medium text-neutral-300">
                        <Info className="w-4 h-4 text-neutral-400 shrink-0" />
                        <span>Android Installation Instructions</span>
                      </div>

                      {isIframe ? (
                        <div className="p-2.5 rounded-lg bg-neutral-950/80 border border-neutral-800 text-[11px] text-neutral-300 space-y-2">
                          <p>
                            <strong>Preview Frame Note:</strong> Browser security restricts the automatic 1-click install prompt from triggering inside an embedded iframe.
                          </p>
                          <button
                            type="button"
                            onClick={handleTriggerPwaInstall}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-medium text-xs transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Open AXON in Standard Tab</span>
                          </button>
                        </div>
                      ) : (
                        <p className="text-[11px] text-neutral-400 leading-relaxed">
                          If the automatic prompt hasn’t appeared, tap Chrome’s menu (<span className="text-white font-semibold">⋮</span>) in the top-right corner and select <strong className="text-white font-semibold">"Install app"</strong> or <strong className="text-white font-semibold">"Add to Home screen"</strong>.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* iOS FLOW */}
              {platform === 'ios' && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <Share2 className="w-3.5 h-3.5 text-neutral-300" />
                        <span>iOS Safari Install Guide</span>
                      </p>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        Safari Manual Flow
                      </span>
                    </div>

                    {!isSafari && (
                      <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/60 text-[11px] text-amber-300">
                        <strong>Note:</strong> iOS requires using Apple Safari to install apps to the Home Screen. Please open this link in Safari.
                      </div>
                    )}

                    <ol className="space-y-2 text-[11px] text-neutral-300 list-decimal list-inside pl-1 leading-relaxed">
                      <li>
                        Tap the <strong className="text-white">Share</strong> icon{' '}
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-200 text-[10px] mx-0.5">
                          <Share2 className="w-3 h-3 inline mr-1" /> Share
                        </span>{' '}
                        in Safari’s bottom toolbar.
                      </li>
                      <li>
                        Scroll down the share sheet and select{' '}
                        <strong className="text-white">"Add to Home Screen"</strong>{' '}
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-200 text-[10px] mx-0.5">
                          <PlusSquare className="w-3 h-3 inline mr-1" /> +
                        </span>
                        .
                      </li>
                      <li>
                        Tap <strong className="text-white">"Add"</strong> in the top-right corner to confirm.
                      </li>
                      <li>
                        AXON will appear on your iOS Home Screen and launch full-screen with no browser address bar.
                      </li>
                    </ol>
                  </div>
                </div>
              )}

              {/* DESKTOP FLOW */}
              {platform === 'desktop' && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-neutral-300" />
                        <span>Desktop Browser Installation</span>
                      </p>
                    </div>
                    {deferredPrompt ? (
                      <div className="flex items-center justify-between gap-3 pt-1">
                        <p className="text-[11px] text-neutral-400">
                          Click to install AXON as a standalone desktop window.
                        </p>
                        <button
                          type="button"
                          onClick={handleTriggerPwaInstall}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-neutral-200 text-black text-xs font-semibold transition-colors shrink-0"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Install App</span>
                        </button>
                      </div>
                    ) : (
                      <p className="text-[11px] text-neutral-400 leading-relaxed">
                        In Chrome or Edge, click the <strong className="text-white">Install</strong> icon in the address bar, or open the browser menu and select <strong className="text-white">"Install AXON"</strong> to add it to your desktop app launcher.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Storage Budget at Install / Device Allocation */}
          <div className="p-3.5 rounded-xl bg-neutral-950/70 border border-neutral-800/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-neutral-300" />
                <span className="text-xs font-semibold text-white">Device Storage Budget</span>
              </div>
              <span className="text-xs font-mono font-bold text-white bg-neutral-900 px-2.5 py-0.5 rounded-full border border-neutral-750">
                {formatBytes(storageBudget.budgetBytes, 0)}
              </span>
            </div>
            <p className="text-[11px] text-neutral-400">
              Allocated quota for offline neural models, reference packs, and local files ({deviceStorageEstimate.calculationExplanation}).
            </p>

            {/* Presets and Custom Input alongside */}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              {presets.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => {
                    setStorageBudgetBytes(opt.bytes);
                    if (showToast) showToast(`Storage budget set to ${opt.label}`);
                  }}
                  title={opt.subtitle}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    storageBudget.budgetBytes === opt.bytes
                      ? 'bg-white text-black border-white font-semibold'
                      : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-750'
                  }`}
                >
                  {opt.label}
                </button>
              ))}

              {/* Free-text / Numeric Custom Budget Input alongside presets */}
              <div className="flex items-center gap-1">
                <div className="relative">
                  <input
                    type="number"
                    min="0.5"
                    max="2048"
                    step="0.5"
                    placeholder="Custom"
                    value={customGb}
                    onChange={(e) => setCustomGb(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = parseFloat(customGb);
                        if (!isNaN(val) && val > 0) {
                          const bytes = Math.round(val * 1024 * 1024 * 1024);
                          setStorageBudgetBytes(bytes);
                          if (showToast) showToast(`Custom storage budget set to ${val} GB`);
                        }
                      }
                    }}
                    className={`w-20 px-2.5 py-1 rounded-lg text-xs bg-neutral-900 border text-white placeholder:text-neutral-500 focus:outline-none focus:border-white pr-7 ${
                      !isPresetActive ? 'border-white font-semibold' : 'border-neutral-750'
                    }`}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-neutral-400 font-mono">
                    GB
                  </span>
                </div>
                <button
                  type="button"
                  disabled={!customGb || isNaN(parseFloat(customGb)) || parseFloat(customGb) <= 0}
                  onClick={() => {
                    const val = parseFloat(customGb);
                    if (!isNaN(val) && val > 0) {
                      const bytes = Math.round(val * 1024 * 1024 * 1024);
                      setStorageBudgetBytes(bytes);
                      if (showToast) showToast(`Custom storage budget set to ${val} GB`);
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-neutral-800 hover:bg-neutral-750 disabled:opacity-40 text-white border border-neutral-700 transition-colors"
                >
                  Set
                </button>
              </div>

              {!isPresetActive && (
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/50">
                  Custom Active: {formatBytes(storageBudget.budgetBytes, 0)}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
