import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, ShieldAlert, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ModalOverlayContainer } from './ModalOverlayContainer';

interface ConfirmationModalProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title = 'Confirm Action',
  message = 'Are you sure you want to delete this?',
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  danger = true,
  onConfirm,
  onCancel,
}) => {
  const { generalSettings } = useApp();

  const timerSeconds =
    generalSettings?.deleteConfirmationTimerEnabled && generalSettings?.deleteConfirmationWaitTimerSeconds > 0
      ? generalSettings.deleteConfirmationWaitTimerSeconds
      : 0;

  const [remainingSeconds, setRemainingSeconds] = useState<number>(timerSeconds);

  useEffect(() => {
    if (!isOpen) return;

    // If danger action and timer is configured, start countdown
    if (danger && timerSeconds > 0) {
      setRemainingSeconds(timerSeconds);
      const timer = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    } else {
      setRemainingSeconds(0);
    }
  }, [isOpen, danger, timerSeconds]);

  if (!isOpen) return null;

  const isLocked = danger && remainingSeconds > 0;

  return (
    <ModalOverlayContainer
      isOpen={isOpen}
      onClose={onCancel}
      id="confirmation-modal"
      maxWidth="sm"
      ariaLabel={title}
      className="p-5 space-y-4 select-none"
    >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                danger ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-neutral-800 text-neutral-300'
              }`}
            >
              {danger ? <ShieldAlert className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <div>
              <h3 id="confirmation-modal-title" className="text-base font-semibold text-white">
                {title}
              </h3>
              {danger && timerSeconds > 0 && (
                <span className="text-[10px] text-neutral-400 flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>Safety countdown active</span>
                </span>
              )}
            </div>
          </div>
          <button
            id="confirmation-modal-close-btn"
            type="button"
            onClick={onCancel}
            className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p id="confirmation-modal-message" className="text-sm text-neutral-300 leading-relaxed">
          {message}
        </p>

        {/* Visual progress countdown bar if locked */}
        {isLocked && (
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-[11px] text-neutral-400 font-mono">
              <span>Wait before confirming</span>
              <span className="text-amber-400 font-semibold">{remainingSeconds}s</span>
            </div>
            <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-1000 ease-linear rounded-full"
                style={{
                  width: `${((timerSeconds - remainingSeconds) / timerSeconds) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            id="confirmation-modal-cancel-btn"
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 active:scale-95 transition-all"
          >
            {cancelLabel}
          </button>

          <button
            id="confirmation-modal-confirm-btn"
            type="button"
            disabled={isLocked}
            onClick={() => {
              if (!isLocked) {
                onConfirm();
              }
            }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              isLocked
                ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
                : danger
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/40 active:scale-95'
                : 'bg-white text-black hover:bg-neutral-200 active:scale-95'
            }`}
          >
            {isLocked ? `${confirmLabel} (${remainingSeconds}s)` : confirmLabel}
          </button>
        </div>
    </ModalOverlayContainer>
  );
};
