import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Download, Maximize2 } from 'lucide-react';

export interface ImageViewerModalProps {
  isOpen: boolean;
  imageUrl: string;
  imageName?: string;
  onClose: () => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  isOpen,
  imageUrl,
  imageName,
  onClose,
}) => {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const startPointerRef = useRef({ x: 0, y: 0 });
  const startPanRef = useRef({ x: 0, y: 0 });
  const lastTapRef = useRef(0);
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef(1);

  // Reset scale and pan when opening a new image
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPan({ x: 0, y: 0 });
    }
  }, [isOpen, imageUrl]);

  // Keyboard navigation (Escape to close, +/- to zoom, 0 to reset)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        setScale((prev) => Math.min(6, +(prev + 0.25).toFixed(2)));
      } else if (e.key === '-' || e.key === '_') {
        setScale((prev) => Math.max(0.5, +(prev - 0.25).toFixed(2)));
      } else if (e.key === '0') {
        setScale(1);
        setPan({ x: 0, y: 0 });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleZoomIn = () => {
    setScale((prev) => Math.min(6, +(prev + 0.25).toFixed(2)));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(0.5, +(prev - 0.25).toFixed(2)));
  };

  const handleResetZoom = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  const handleDownload = () => {
    try {
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = imageName || `image-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to download image:', err);
    }
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * -0.0015;
    setScale((prev) => Math.min(6, Math.max(0.5, +(prev + delta).toFixed(2))));
  };

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    setIsDragging(true);
    startPointerRef.current = { x: e.clientX, y: e.clientY };
    startPanRef.current = { ...pan };
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - startPointerRef.current.x;
      const dy = e.clientY - startPointerRef.current.y;
      setPan({
        x: startPanRef.current.x + dx,
        y: startPanRef.current.y + dy,
      });
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch handlers for mobile (pinch to zoom, 1-finger pan, double-tap toggle)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchStartDistRef.current = dist;
      pinchStartScaleRef.current = scale;
      setIsDragging(false);
    } else if (e.touches.length === 1) {
      const now = Date.now();
      // Double tap toggle between 1x and 2.5x
      if (now - lastTapRef.current < 300) {
        if (scale > 1.2) {
          setScale(1);
          setPan({ x: 0, y: 0 });
        } else {
          setScale(2.5);
        }
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;

      setIsDragging(true);
      startPointerRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      startPanRef.current = { ...pan };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDistRef.current !== null) {
      if (e.cancelable) e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / pinchStartDistRef.current;
      const newScale = Math.min(6, Math.max(0.5, +(pinchStartScaleRef.current * ratio).toFixed(2)));
      setScale(newScale);
    } else if (e.touches.length === 1 && isDragging) {
      const dx = e.touches[0].clientX - startPointerRef.current.x;
      const dy = e.touches[0].clientY - startPointerRef.current.y;
      setPan({
        x: startPanRef.current.x + dx,
        y: startPanRef.current.y + dy,
      });
    }
  };

  const handleTouchEnd = () => {
    pinchStartDistRef.current = null;
    setIsDragging(false);
  };

  if (!isOpen || !imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-md select-none animate-in fade-in duration-150"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Top Header Bar */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-neutral-800 bg-neutral-900/80 shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-medium text-white truncate max-w-xs sm:max-w-md">
            {imageName || 'Image Viewer'}
          </span>
          <span className="px-2 py-0.5 rounded text-xs font-mono bg-neutral-800 text-neutral-300">
            {Math.round(scale * 100)}%
          </span>
        </div>

        {/* Toolbar controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom Out (-)"
            aria-label="Zoom out"
            className="p-2 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 active:scale-95 transition-all"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom In (+)"
            aria-label="Zoom in"
            className="p-2 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 active:scale-95 transition-all"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            title="Reset Zoom (0)"
            aria-label="Reset zoom"
            className="p-2 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 active:scale-95 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleDownload}
            title="Download Image"
            aria-label="Download image"
            className="p-2 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 active:scale-95 transition-all"
          >
            <Download className="w-4 h-4" />
          </button>
          <div className="h-5 w-px bg-neutral-800 mx-1" />
          <button
            type="button"
            onClick={onClose}
            title="Close (Esc)"
            aria-label="Close viewer"
            className="p-2 rounded-lg text-neutral-300 hover:text-white hover:bg-red-950/80 hover:text-red-300 active:scale-95 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div
        className="flex-1 relative overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing touch-none p-4"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => {
          // If user clicked directly on backdrop (not the image), close
          if (e.target === e.currentTarget && scale === 1) {
            onClose();
          }
        }}
      >
        <img
          src={imageUrl}
          alt={imageName || 'Enlarged view'}
          draggable={false}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
            maxHeight: '85vh',
            maxWidth: '90vw',
          }}
          className="object-contain shadow-2xl rounded select-none pointer-events-auto"
        />
      </div>

      {/* Bottom Hint Footer */}
      <div className="h-8 px-4 flex items-center justify-center border-t border-neutral-800 bg-neutral-900/60 shrink-0 text-xs text-neutral-400 font-mono">
        <span>Scroll / Pinch to zoom • Drag to pan • Double-tap to toggle zoom • Esc to exit</span>
      </div>
    </div>
  );
};
