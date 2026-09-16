/**
 * AXON Unified Media Foundation — Shared Import Pipeline
 * Single entry point for bringing in images, videos, and audio files from device/gallery,
 * generating unified Asset records, extracting metadata, generating thumbnails,
 * and hooking seamlessly into the existing AXON Storage/Manifest system.
 */

import {
  AssetCategory,
  AssetManifestItem,
  SaveMode,
} from '../../types';
import {
  MediaAsset,
  MediaAssetMetadata,
  MediaAssetType,
  MediaImportOptions,
  MediaImportResult,
} from './types';

/**
 * Determines media category type ('image', 'video', 'audio') from mime-type or file extension.
 */
export function detectMediaType(mimeType: string, filename?: string): MediaAssetType {
  const lowerMime = (mimeType || '').toLowerCase();
  const lowerName = (filename || '').toLowerCase();

  if (lowerMime.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|bmp|avif|heic)$/i.test(lowerName)) {
    return 'image';
  }
  if (lowerMime.startsWith('video/') || /\.(mp4|webm|mov|m4v|mkv|avi|ogv)$/i.test(lowerName)) {
    return 'video';
  }
  if (lowerMime.startsWith('audio/') || /\.(mp3|wav|ogg|aac|m4a|flac|weba)$/i.test(lowerName)) {
    return 'audio';
  }

  // Fallback defaults to image if ambiguous
  return 'image';
}

/**
 * Extracts metadata (dimensions, duration, file size) and generates a preview thumbnail.
 */
export async function extractMediaMetadataAndThumbnail(
  fileOrBlob: Blob | File,
  type: MediaAssetType,
  options?: { thumbnailMaxDim?: number }
): Promise<{ metadata: MediaAssetMetadata; thumbnailUrl?: string; uri: string }> {
  const maxDim = options?.thumbnailMaxDim ?? 256;
  const fileSizeBytes = fileOrBlob.size;
  const uri = URL.createObjectURL(fileOrBlob);

  const baseMetadata: MediaAssetMetadata = {
    fileSizeBytes,
  };

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { metadata: baseMetadata, uri };
  }

  try {
    if (type === 'image') {
      return await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const width = img.naturalWidth || img.width;
          const height = img.naturalHeight || img.height;
          const aspectRatio = width > 0 && height > 0 ? width / height : undefined;

          // Generate thumbnail via canvas
          let thumbnailUrl: string | undefined = undefined;
          try {
            const canvas = document.createElement('canvas');
            let thumbW = width;
            let thumbH = height;

            if (thumbW > maxDim || thumbH > maxDim) {
              if (thumbW > thumbH) {
                thumbH = Math.round((thumbH * maxDim) / thumbW);
                thumbW = maxDim;
              } else {
                thumbW = Math.round((thumbW * maxDim) / thumbH);
                thumbH = maxDim;
              }
            }

            canvas.width = Math.max(1, thumbW);
            canvas.height = Math.max(1, thumbH);
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
            }
          } catch (e) {
            console.warn('[extractMediaMetadataAndThumbnail] Thumbnail generation failed:', e);
          }

          resolve({
            metadata: {
              ...baseMetadata,
              width,
              height,
              aspectRatio,
            },
            thumbnailUrl,
            uri,
          });
        };

        img.onerror = () => {
          resolve({ metadata: baseMetadata, uri });
        };

        img.src = uri;
      });
    }

    if (type === 'video') {
      return await new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;

        let resolved = false;
        const cleanupAndResolve = (meta: MediaAssetMetadata, thumb?: string) => {
          if (resolved) return;
          resolved = true;
          video.src = '';
          resolve({ metadata: meta, thumbnailUrl: thumb, uri });
        };

        video.onloadedmetadata = () => {
          const duration = isFinite(video.duration) ? video.duration : 0;
          const width = video.videoWidth || 640;
          const height = video.videoHeight || 360;
          const aspectRatio = width > 0 && height > 0 ? width / height : 16 / 9;

          const meta: MediaAssetMetadata = {
            ...baseMetadata,
            width,
            height,
            aspectRatio,
            durationSeconds: duration,
          };

          // Try to capture thumbnail frame at 0.5s or 10%
          const seekTarget = Math.min(1.0, Math.max(0.1, duration * 0.1));
          video.currentTime = seekTarget;

          video.onseeked = () => {
            try {
              const canvas = document.createElement('canvas');
              let thumbW = width;
              let thumbH = height;

              if (thumbW > maxDim || thumbH > maxDim) {
                if (thumbW > thumbH) {
                  thumbH = Math.round((thumbH * maxDim) / thumbW);
                  thumbW = maxDim;
                } else {
                  thumbW = Math.round((thumbW * maxDim) / thumbH);
                  thumbH = maxDim;
                }
              }

              canvas.width = Math.max(1, thumbW);
              canvas.height = Math.max(1, thumbH);
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const thumb = canvas.toDataURL('image/jpeg', 0.8);
                cleanupAndResolve(meta, thumb);
                return;
              }
            } catch (e) {
              console.warn('[extractMediaMetadataAndThumbnail] Video frame capture failed:', e);
            }
            cleanupAndResolve(meta);
          };
        };

        video.onerror = () => {
          cleanupAndResolve(baseMetadata);
        };

        // Safety timeout
        setTimeout(() => {
          cleanupAndResolve(baseMetadata);
        }, 3000);

        video.src = uri;
      });
    }

    if (type === 'audio') {
      return await new Promise((resolve) => {
        const audio = document.createElement('audio');
        audio.preload = 'metadata';

        audio.onloadedmetadata = () => {
          const duration = isFinite(audio.duration) ? audio.duration : 0;
          resolve({
            metadata: {
              ...baseMetadata,
              durationSeconds: duration,
            },
            uri,
          });
        };

        audio.onerror = () => {
          resolve({ metadata: baseMetadata, uri });
        };

        setTimeout(() => {
          resolve({ metadata: baseMetadata, uri });
        }, 2500);

        audio.src = uri;
      });
    }
  } catch (err) {
    console.warn('[extractMediaMetadataAndThumbnail] Error extracting metadata:', err);
  }

  return { metadata: baseMetadata, uri };
}

/**
 * Converts a MediaAsset into a standard AXON AssetManifestItem registration payload.
 */
export function buildManifestItemFromMediaAsset(
  asset: MediaAsset,
  options?: {
    category?: AssetCategory;
    saveMode?: SaveMode;
  }
): Omit<AssetManifestItem, 'id' | 'createdAt' | 'updatedAt' | 'lastAccessedAt'> & { id?: string } {
  const category: AssetCategory = options?.category || 'user_file';
  const saveMode: SaveMode = options?.saveMode || 'archive';

  return {
    id: `asset-${category}-${asset.id}`,
    name: asset.name,
    category,
    storageLocation: asset.source.uri,
    mimeType: asset.source.mimeType,
    originalSizeBytes: asset.metadata.fileSizeBytes || 1024,
    storedSizeBytes: asset.metadata.fileSizeBytes || 1024,
    allocatedSizeBytes: asset.metadata.fileSizeBytes || 1024,
    saveMode,
    isOriginalPreserved: true,
    qualityState: 'original',
    knowledgeStatus: 'not_applicable',
    isEnabled: true,
    description: `Media Foundation ${asset.type}: ${asset.name}`,
    metadata: {
      mediaAssetId: asset.id,
      mediaType: asset.type,
      width: asset.metadata.width,
      height: asset.metadata.height,
      durationSeconds: asset.metadata.durationSeconds,
      thumbnailUrl: asset.thumbnailUrl,
      projectId: asset.projectId,
      sourceType: asset.source.type,
    },
  };
}

/**
 * Reconstructs a MediaAsset from an existing AXON Storage/Manifest item.
 */
export function importFromManifestItem(manifestItem: AssetManifestItem): MediaAsset {
  const meta = manifestItem.metadata || {};
  const mediaType: MediaAssetType =
    (meta.mediaType as MediaAssetType) ||
    detectMediaType(manifestItem.mimeType, manifestItem.name);

  const assetId = meta.mediaAssetId || manifestItem.id.replace(/^asset-[^-]+-/, '');

  return {
    id: assetId,
    name: manifestItem.name,
    type: mediaType,
    source: {
      type: manifestItem.storageLocation.startsWith('data:')
        ? 'data_url'
        : manifestItem.storageLocation.startsWith('blob:')
        ? 'blob_url'
        : 'file_path',
      uri: manifestItem.storageLocation,
      fileName: manifestItem.name,
      mimeType: manifestItem.mimeType,
    },
    metadata: {
      fileSizeBytes: manifestItem.storedSizeBytes || manifestItem.originalSizeBytes || 1024,
      width: meta.width,
      height: meta.height,
      aspectRatio: meta.width && meta.height ? meta.width / meta.height : undefined,
      durationSeconds: meta.durationSeconds,
      custom: meta,
    },
    thumbnailUrl: meta.thumbnailUrl || (manifestItem.mimeType.startsWith('image/') ? manifestItem.storageLocation : undefined),
    manifestAssetId: manifestItem.id,
    projectId: meta.projectId,
    createdAt: manifestItem.createdAt,
    updatedAt: manifestItem.updatedAt,
  };
}

/**
 * Primary Unified Media Import Pipeline:
 * Ingests a File, Blob, or URL string into a Unified MediaAsset, extracts metadata,
 * generates a thumbnail preview, and hooks into AXON's Storage Manifest system.
 */
export async function importMediaFile(
  input: File | Blob | string,
  options?: MediaImportOptions
): Promise<MediaImportResult> {
  const now = new Date().toISOString();
  let fileOrBlob: Blob;
  let filename = 'media-asset';
  let mimeType = 'application/octet-stream';
  let sourceType: MediaAsset['source']['type'] = 'blob_url';

  if (typeof input === 'string') {
    if (input.startsWith('data:')) {
      // Data URL
      const match = input.match(/^data:([^;]+);/);
      mimeType = match ? match[1] : 'image/png';
      sourceType = 'data_url';
      filename = `imported-${Date.now()}.${mimeType.split('/')[1] || 'bin'}`;
      // Convert dataUrl to blob for metadata extraction
      const res = await fetch(input);
      fileOrBlob = await res.blob();
    } else {
      // Remote URL or object URL
      sourceType = input.startsWith('blob:') ? 'blob_url' : 'remote_url';
      filename = input.split('/').pop()?.split('?')[0] || `media-${Date.now()}`;
      try {
        const res = await fetch(input);
        fileOrBlob = await res.blob();
        mimeType = fileOrBlob.type || mimeType;
      } catch {
        // Offline or cors restricted, create a synthetic blob
        fileOrBlob = new Blob([], { type: mimeType });
      }
    }
  } else {
    fileOrBlob = input;
    if (input instanceof File) {
      filename = input.name;
      mimeType = input.type || mimeType;
    } else {
      mimeType = input.type || mimeType;
      filename = `media-${Date.now()}.${mimeType.split('/')[1] || 'bin'}`;
    }
    sourceType = 'blob_url';
  }

  const mediaType = detectMediaType(mimeType, filename);
  const uniqueId = `media-${mediaType}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  // Extract dimensions, duration, and thumbnail
  const extraction = await extractMediaMetadataAndThumbnail(fileOrBlob, mediaType, {
    thumbnailMaxDim: options?.thumbnailMaxDim ?? 256,
  });

  const asset: MediaAsset = {
    id: uniqueId,
    name: filename,
    type: mediaType,
    source: {
      type: sourceType,
      uri: extraction.uri,
      fileName: filename,
      mimeType,
      file: fileOrBlob instanceof File ? fileOrBlob : undefined,
    },
    metadata: extraction.metadata,
    thumbnailUrl: extraction.thumbnailUrl,
    projectId: options?.projectId,
    createdAt: now,
    updatedAt: now,
  };

  let manifestItem: AssetManifestItem | undefined;

  // Register with AXON Storage Manifest if requested
  if (options?.registerInManifest !== false && options?.manifestRegisterFn) {
    try {
      const manifestPayload = buildManifestItemFromMediaAsset(asset, {
        category: options?.category,
        saveMode: options?.saveMode,
      });
      manifestItem = options.manifestRegisterFn(manifestPayload);
      if (manifestItem) {
        asset.manifestAssetId = manifestItem.id;
      }
    } catch (err) {
      console.warn('[importMediaFile] Manifest registration warning:', err);
    }
  }

  return {
    asset,
    manifestItem,
  };
}

/**
 * Batch imports multiple media files.
 */
export async function importMediaBatch(
  inputs: (File | Blob | string)[],
  options?: MediaImportOptions
): Promise<MediaImportResult[]> {
  const results: MediaImportResult[] = [];
  for (const input of inputs) {
    try {
      const res = await importMediaFile(input, options);
      results.push(res);
    } catch (err) {
      console.error('[importMediaBatch] Error importing file:', err);
    }
  }
  return results;
}
