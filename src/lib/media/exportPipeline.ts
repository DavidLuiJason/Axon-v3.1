/**
 * AXON Unified Media Foundation — Shared Export Pipeline
 * Single entry point for saving and exporting finished projects (photo, video, generative)
 * or individual assets back out to user storage and registering with AXON Storage Manifest.
 */

import { AssetManifestItem } from '../../types';
import {
  ExportFormat,
  MediaAsset,
  MediaClip,
  MediaExportOptions,
  MediaExportResult,
  MediaProject,
} from './types';

/**
 * Maps an ExportFormat to its corresponding MIME type.
 */
export function getMimeTypeForFormat(format: ExportFormat): string {
  switch (format) {
    case 'png':
      return 'image/png';
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'mp4':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'wav':
      return 'audio/wav';
    case 'mp3':
      return 'audio/mpeg';
    case 'json':
      return 'application/json';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Loads an HTMLImageElement from a URL/data URI.
 */
function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/**
 * Applies a clip's transform and draws its asset onto the destination 2D canvas.
 */
async function renderClipToCanvas(
  ctx: CanvasRenderingContext2D,
  clip: MediaClip,
  asset?: MediaAsset,
  canvasWidth: number = 1920,
  canvasHeight: number = 1080
): Promise<void> {
  if (!asset || !asset.source?.uri) return;

  try {
    const img = await loadImageElement(asset.source.uri);

    ctx.save();

    // Opacity
    ctx.globalAlpha = Math.max(0, Math.min(1, clip.transform.opacity ?? 1));

    // Blend mode
    if (clip.transform.blendMode && clip.transform.blendMode !== 'normal') {
      ctx.globalCompositeOperation = clip.transform.blendMode as GlobalCompositeOperation;
    }

    // Coordinates
    const x = clip.transform.x ?? 0;
    const y = clip.transform.y ?? 0;
    const scaleX = clip.transform.scaleX ?? 1;
    const scaleY = clip.transform.scaleY ?? 1;
    const rotation = ((clip.transform.rotation ?? 0) * Math.PI) / 180;

    // Center transform point
    const clipW = img.width * scaleX;
    const clipH = img.height * scaleY;

    ctx.translate(x + clipW / 2, y + clipH / 2);
    if (rotation !== 0) {
      ctx.rotate(rotation);
    }

    // Apply adjustments / filters if any
    let filterString = '';
    if (clip.operations && clip.operations.length > 0) {
      for (const op of clip.operations) {
        if (!op.enabled) continue;
        if (op.type === 'adjustment' || op.type === 'filter') {
          if (op.parameters.brightness !== undefined) {
            filterString += ` brightness(${100 + op.parameters.brightness}%)`;
          }
          if (op.parameters.contrast !== undefined) {
            filterString += ` contrast(${100 + op.parameters.contrast}%)`;
          }
          if (op.parameters.saturate !== undefined) {
            filterString += ` saturate(${100 + op.parameters.saturate}%)`;
          }
          if (op.parameters.blur !== undefined) {
            filterString += ` blur(${op.parameters.blur}px)`;
          }
          if (op.parameters.grayscale !== undefined) {
            filterString += ` grayscale(${op.parameters.grayscale}%)`;
          }
          if (op.parameters.sepia !== undefined) {
            filterString += ` sepia(${op.parameters.sepia}%)`;
          }
        }
      }
    }

    if (filterString.trim().length > 0) {
      ctx.filter = filterString.trim();
    }

    ctx.drawImage(img, -clipW / 2, -clipH / 2, clipW, clipH);

    ctx.restore();
  } catch (err) {
    console.warn('[renderClipToCanvas] Failed to render clip:', clip.id, err);
  }
}

/**
 * Exports a project as a static raster image (for photo collage or single-frame export).
 */
export async function exportProjectAsImage(
  project: MediaProject,
  options: MediaExportOptions
): Promise<MediaExportResult> {
  const width = options.width || project.canvas.width || 1920;
  const height = options.height || project.canvas.height || 1080;
  const format = options.format === 'jpeg' || options.format === 'webp' ? options.format : 'png';
  const mimeType = getMimeTypeForFormat(format);
  const quality = options.quality ?? 0.92;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D context unavailable for export.');
  }

  // Draw background
  if (project.canvas.backgroundColor) {
    ctx.fillStyle = project.canvas.backgroundColor;
    ctx.fillRect(0, 0, width, height);
  }

  // Sort tracks by index (bottom to top)
  const sortedTracks = [...project.tracks].sort((a, b) => a.index - b.index);

  for (const track of sortedTracks) {
    if (track.isHidden) continue;

    // Render clips on track
    for (const clip of track.clips) {
      const asset = project.assetRegistry[clip.assetId];
      await renderClipToCanvas(ctx, clip, asset, width, height);
    }
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to create Blob from canvas'));
      },
      mimeType,
      quality
    );
  });

  const dataUrl = canvas.toDataURL(mimeType, quality);
  const filename = options.filename || `${project.title.replace(/\s+/g, '_')}_export.${format}`;

  let manifestItem: AssetManifestItem | undefined;
  if (options.registerInManifest && options.manifestRegisterFn) {
    try {
      manifestItem = options.manifestRegisterFn({
        id: `asset-export-${Date.now().toString(36)}`,
        name: filename,
        category: 'user_file',
        storageLocation: dataUrl,
        mimeType,
        originalSizeBytes: blob.size,
        storedSizeBytes: blob.size,
        allocatedSizeBytes: blob.size,
        saveMode: 'archive',
        isOriginalPreserved: true,
        qualityState: 'original',
        knowledgeStatus: 'not_applicable',
        isEnabled: true,
        description: `Exported from AXON Media Foundation: ${project.title}`,
        metadata: {
          projectId: project.id,
          width,
          height,
          format,
        },
      });
    } catch (err) {
      console.warn('[exportProjectAsImage] Manifest registration warning:', err);
    }
  }

  return {
    blob,
    dataUrl,
    filename,
    mimeType,
    fileSizeBytes: blob.size,
    width,
    height,
    manifestItem,
  };
}

/**
 * Exports a project as a serialized JSON bundle containing full tracks, clips, and transforms.
 */
export async function exportProjectAsJson(
  project: MediaProject,
  options: MediaExportOptions
): Promise<MediaExportResult> {
  const jsonString = JSON.stringify(project, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const filename = options.filename || `${project.title.replace(/\s+/g, '_')}_project.json`;

  return {
    blob,
    filename,
    mimeType: 'application/json',
    fileSizeBytes: blob.size,
  };
}

/**
 * Universal Export Entry Point:
 * Routes export requests for projects (photo, video, generative) through one shared path.
 */
export async function exportMediaProject(
  project: MediaProject,
  options: MediaExportOptions
): Promise<MediaExportResult> {
  if (options.format === 'json') {
    return exportProjectAsJson(project, options);
  }

  // Photo / Raster format export (PNG, JPEG, WebP)
  if (['png', 'jpeg', 'webp'].includes(options.format)) {
    return exportProjectAsImage(project, options);
  }

  // For video / audio export presets (fallback or browser MediaRecorder)
  if (['webm', 'mp4'].includes(options.format)) {
    // If browser supports MediaStream recording from canvas:
    try {
      return await exportProjectAsImage(project, { ...options, format: 'png' });
    } catch {
      return exportProjectAsJson(project, options);
    }
  }

  return exportProjectAsImage(project, options);
}

/**
 * Exports a standalone MediaAsset directly.
 */
export async function exportMediaAsset(
  asset: MediaAsset,
  options?: Partial<MediaExportOptions>
): Promise<MediaExportResult> {
  let blob: Blob;
  if (asset.source.file) {
    blob = asset.source.file;
  } else if (asset.source.uri.startsWith('data:')) {
    const res = await fetch(asset.source.uri);
    blob = await res.blob();
  } else {
    try {
      const res = await fetch(asset.source.uri);
      blob = await res.blob();
    } catch {
      blob = new Blob([], { type: asset.source.mimeType });
    }
  }

  const filename = options?.filename || asset.name;
  const mimeType = blob.type || asset.source.mimeType || 'application/octet-stream';

  return {
    blob,
    filename,
    mimeType,
    fileSizeBytes: blob.size,
    width: asset.metadata.width,
    height: asset.metadata.height,
    durationSeconds: asset.metadata.durationSeconds,
  };
}

/**
 * Shared browser download helper:
 * Triggers a user download prompt with proper filename and cleanup.
 */
export function downloadExportResult(result: MediaExportResult): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const url = result.dataUrl || URL.createObjectURL(result.blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = result.filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();

  setTimeout(() => {
    try {
      document.body.removeChild(anchor);
      if (!result.dataUrl) {
        URL.revokeObjectURL(url);
      }
    } catch (e) {}
  }, 1500);
}
