/**
 * AXON Unified Media Foundation — Type Definitions
 * Shared foundation for Photo Editor, Video Editor, and Image Generation/Enhancement tools.
 */

import { AssetCategory, AssetManifestItem, QualityState, SaveMode } from '../../types';

// ============================================================================
// 1. Unified Asset Model
// ============================================================================

export type MediaAssetType = 'image' | 'video' | 'audio';

export type MediaSourceType =
  | 'blob_url'
  | 'data_url'
  | 'indexed_db'
  | 'remote_url'
  | 'file_path';

export interface MediaAssetSource {
  type: MediaSourceType;
  uri: string;
  fileName: string;
  mimeType: string;
  file?: File | Blob;
}

export interface MediaAssetMetadata {
  fileSizeBytes: number;
  width?: number;
  height?: number;
  aspectRatio?: number;
  durationSeconds?: number;
  frameRate?: number;
  sampleRate?: number;
  channels?: number;
  hasAlpha?: boolean;
  colorSpace?: string;
  exif?: Record<string, any>;
  custom?: Record<string, any>;
}

export interface MediaAsset {
  id: string;
  name: string;
  type: MediaAssetType;
  source: MediaAssetSource;
  metadata: MediaAssetMetadata;
  thumbnailUrl?: string; // Preview reference / thumbnail data URI
  manifestAssetId?: string; // Linked ID in AXON Storage Manifest system
  projectId?: string;
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
  tags?: string[];
}

// ============================================================================
// 2. Unified Project / Timeline Data Model
// ============================================================================

export type MediaProjectKind = 'video' | 'photo' | 'generative';

export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion';

export interface MediaTransform {
  x: number; // Offset X (pixels or normalized percentage)
  y: number; // Offset Y (pixels or normalized percentage)
  scaleX: number; // Scale factor X (1.0 = 100%)
  scaleY: number; // Scale factor Y (1.0 = 100%)
  rotation: number; // Angle in degrees
  opacity: number; // 0.0 to 1.0
  zIndex?: number; // Layer stacking order
  blendMode?: BlendMode;
}

export interface MediaTrim {
  inPointSeconds: number; // Start offset within the source media
  outPointSeconds: number; // End offset within the source media
  speedMultiplier: number; // Playback speed (1.0 = 1x normal)
}

export interface MediaTimeSlice {
  startSeconds: number; // Position on project timeline (0 for static photo projects)
  durationSeconds: number; // Duration on timeline (0 or infinite/static for photos)
}

export type MediaOperationType =
  | 'filter'
  | 'adjustment'
  | 'crop'
  | 'ai_enhance'
  | 'ai_generate'
  | 'text_overlay'
  | 'mask'
  | 'custom';

export interface MediaOperation {
  id: string;
  type: MediaOperationType;
  name: string;
  parameters: Record<string, any>; // e.g. { brightness: 10, contrast: 5, prompt: "...", seed: 42 }
  enabled: boolean;
  createdAt: string;
}

export type MediaClipType = MediaAssetType | 'text' | 'shape' | 'adjustment_layer';

export interface MediaClip {
  id: string;
  name: string;
  assetId: string; // References a MediaAsset.id in the project's assetRegistry
  type: MediaClipType;
  trim?: MediaTrim; // Time-trimming data for video/audio
  timeSlice: MediaTimeSlice; // Timeline placement (time-based for video, layer duration for photo)
  transform: MediaTransform; // Spatial positioning & compositing
  volume?: number; // 0.0 to 1.0 (for audio/video)
  isMuted?: boolean;
  operations?: MediaOperation[]; // Clip-level adjustments, filters, or AI operations
  metadata?: Record<string, any>;
}

export type MediaTrackKind = 'video' | 'audio' | 'overlay' | 'image_layer';

export interface MediaTrack {
  id: string;
  name: string;
  kind: MediaTrackKind;
  index: number; // Visual track order / layer index
  isMuted?: boolean;
  isHidden?: boolean;
  isLocked?: boolean;
  clips: MediaClip[];
}

export interface MediaCanvasSettings {
  width: number;
  height: number;
  fps?: number; // Frames per second for video (e.g. 30 or 60)
  backgroundColor?: string;
  aspectRatio?: string; // e.g. '16:9', '9:16', '1:1', '4:3'
}

export interface MediaProject {
  id: string;
  title: string;
  kind: MediaProjectKind;
  canvas: MediaCanvasSettings;
  durationSeconds: number; // Total timeline duration (0 for single photo/static graphic)
  tracks: MediaTrack[]; // Tracks (video) or Layers (photo collage)
  assetRegistry: Record<string, MediaAsset>; // Lookup dictionary of assets used in this project
  operationsHistory?: MediaOperation[]; // Global project operations (e.g. image generation/enhancement pipeline)
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// 3. Shared Undo / Redo History Types
// ============================================================================

export interface HistoryEntry<T> {
  state: T;
  timestamp: number;
  actionDescription?: string;
}

export interface HistorySnapshot<T> {
  past: HistoryEntry<T>[];
  present: T;
  future: HistoryEntry<T>[];
  canUndo: boolean;
  canRedo: boolean;
}

export interface HistoryOptions {
  maxDepth?: number;
}

// ============================================================================
// 4. Shared Import Pipeline Types
// ============================================================================

export interface MediaImportOptions {
  projectId?: string;
  category?: AssetCategory; // AXON storage category (defaults to 'user_file')
  saveMode?: SaveMode; // 'archive' | 'space_saver'
  generateThumbnail?: boolean; // Generate preview data URI (default: true)
  thumbnailMaxDim?: number; // Thumbnail max width/height (default: 256)
  registerInManifest?: boolean; // Automatically register into AXON Storage Manifest (default: true)
  manifestRegisterFn?: (
    item: Omit<AssetManifestItem, 'id' | 'createdAt' | 'updatedAt' | 'lastAccessedAt'> & { id?: string }
  ) => AssetManifestItem;
}

export interface MediaImportResult {
  asset: MediaAsset;
  manifestItem?: AssetManifestItem;
  warnings?: string[];
}

// ============================================================================
// 5. Shared Export Pipeline Types
// ============================================================================

export type ExportFormat = 'png' | 'jpeg' | 'webp' | 'mp4' | 'webm' | 'json' | 'wav' | 'mp3';

export interface MediaExportOptions {
  format: ExportFormat;
  quality?: number; // 0.0 to 1.0 (for JPEG/WebP)
  width?: number; // Target export resolution
  height?: number;
  fps?: number; // For video export
  timeRange?: {
    startSeconds: number;
    durationSeconds: number;
  };
  includeAudio?: boolean;
  filename?: string;
  registerInManifest?: boolean; // Save export output back into AXON Storage Manifest
  manifestRegisterFn?: (
    item: Omit<AssetManifestItem, 'id' | 'createdAt' | 'updatedAt' | 'lastAccessedAt'> & { id?: string }
  ) => AssetManifestItem;
}

export interface MediaExportResult {
  blob: Blob;
  dataUrl?: string;
  filename: string;
  mimeType: string;
  fileSizeBytes: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
  manifestItem?: AssetManifestItem;
}
