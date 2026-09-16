/**
 * AXON Unified Media Foundation — Unified Project & Timeline Model
 * Factory and state manipulation utilities for photo collages, video timelines,
 * and generative/enhancement pipelines using a single shared data model.
 */

import {
  MediaAsset,
  MediaClip,
  MediaOperation,
  MediaProject,
  MediaProjectKind,
  MediaTrack,
  MediaTrackKind,
  MediaTransform,
  MediaTrim,
} from './types';

/**
 * Returns a standard default spatial transform.
 */
export function createDefaultTransform(overrides?: Partial<MediaTransform>): MediaTransform {
  return {
    x: 0,
    y: 0,
    scaleX: 1.0,
    scaleY: 1.0,
    rotation: 0,
    opacity: 1.0,
    blendMode: 'normal',
    ...overrides,
  };
}

/**
 * Returns a standard default trim structure.
 */
export function createDefaultTrim(durationSeconds: number = 5.0): MediaTrim {
  return {
    inPointSeconds: 0,
    outPointSeconds: durationSeconds,
    speedMultiplier: 1.0,
  };
}

/**
 * Factory for a Photo Collage / Static Canvas project.
 * Uses layers ('image_layer') without time dimension constraints.
 */
export function createPhotoProject(
  title: string,
  options?: {
    width?: number;
    height?: number;
    backgroundColor?: string;
    baseAsset?: MediaAsset;
  }
): MediaProject {
  const width = options?.width || 1920;
  const height = options?.height || 1080;
  const now = new Date().toISOString();
  const projectId = `proj-photo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  const tracks: MediaTrack[] = [
    {
      id: `layer-0-${Date.now().toString(36)}`,
      name: 'Background Layer',
      kind: 'image_layer',
      index: 0,
      clips: [],
    },
  ];

  const assetRegistry: Record<string, MediaAsset> = {};

  if (options?.baseAsset) {
    const asset = options.baseAsset;
    assetRegistry[asset.id] = asset;

    const baseClip: MediaClip = {
      id: `clip-${Date.now().toString(36)}-0`,
      name: asset.name,
      assetId: asset.id,
      type: 'image',
      timeSlice: { startSeconds: 0, durationSeconds: 0 },
      transform: createDefaultTransform(),
    };
    tracks[0].clips.push(baseClip);
  }

  return {
    id: projectId,
    title: title || 'Untitled Photo Project',
    kind: 'photo',
    canvas: {
      width,
      height,
      backgroundColor: options?.backgroundColor || '#121212',
    },
    durationSeconds: 0,
    tracks,
    assetRegistry,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Factory for a Video Timeline project.
 * Uses time-aligned video and audio tracks with in/out trimming and speed.
 */
export function createVideoProject(
  title: string,
  options?: {
    width?: number;
    height?: number;
    fps?: number;
    backgroundColor?: string;
  }
): MediaProject {
  const width = options?.width || 1920;
  const height = options?.height || 1080;
  const fps = options?.fps || 30;
  const now = new Date().toISOString();
  const projectId = `proj-video-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  const tracks: MediaTrack[] = [
    {
      id: `track-v1-${Date.now().toString(36)}`,
      name: 'Video Track 1',
      kind: 'video',
      index: 0,
      clips: [],
    },
    {
      id: `track-a1-${Date.now().toString(36)}`,
      name: 'Audio Track 1',
      kind: 'audio',
      index: 1,
      clips: [],
    },
  ];

  return {
    id: projectId,
    title: title || 'Untitled Video Project',
    kind: 'video',
    canvas: {
      width,
      height,
      fps,
      backgroundColor: options?.backgroundColor || '#000000',
    },
    durationSeconds: 0,
    tracks,
    assetRegistry: {},
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Factory for an Offline Image Generation / Enhancement project.
 * Uses a single canvas track and records pipeline operations in operationsHistory.
 */
export function createGenerativeProject(
  title: string,
  options?: {
    initialAsset?: MediaAsset;
    initialPrompt?: string;
    width?: number;
    height?: number;
  }
): MediaProject {
  const width = options?.width || 1024;
  const height = options?.height || 1024;
  const now = new Date().toISOString();
  const projectId = `proj-gen-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  const assetRegistry: Record<string, MediaAsset> = {};
  const tracks: MediaTrack[] = [
    {
      id: `track-gen-0`,
      name: 'Generative Canvas',
      kind: 'image_layer',
      index: 0,
      clips: [],
    },
  ];

  const operationsHistory: MediaOperation[] = [];

  if (options?.initialPrompt) {
    operationsHistory.push({
      id: `op-gen-prompt-${Date.now().toString(36)}`,
      type: 'ai_generate',
      name: 'Initial Prompt Generation',
      parameters: { prompt: options.initialPrompt },
      enabled: true,
      createdAt: now,
    });
  }

  if (options?.initialAsset) {
    const asset = options.initialAsset;
    assetRegistry[asset.id] = asset;

    tracks[0].clips.push({
      id: `clip-gen-base`,
      name: asset.name,
      assetId: asset.id,
      type: 'image',
      timeSlice: { startSeconds: 0, durationSeconds: 0 },
      transform: createDefaultTransform(),
    });
  }

  return {
    id: projectId,
    title: title || 'Generative Project',
    kind: 'generative',
    canvas: {
      width,
      height,
      backgroundColor: '#18181b',
    },
    durationSeconds: 0,
    tracks,
    assetRegistry,
    operationsHistory,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Recalculates total project duration based on clip endpoints.
 */
export function calculateProjectDuration(tracks: MediaTrack[]): number {
  let maxEndTime = 0;
  for (const track of tracks) {
    if (track.isMuted) continue;
    for (const clip of track.clips) {
      const clipEnd = (clip.timeSlice?.startSeconds || 0) + (clip.timeSlice?.durationSeconds || 0);
      if (clipEnd > maxEndTime) {
        maxEndTime = clipEnd;
      }
    }
  }
  return maxEndTime;
}

/**
 * Adds an asset to a project's asset registry.
 */
export function addAssetToProject(project: MediaProject, asset: MediaAsset): MediaProject {
  return {
    ...project,
    assetRegistry: {
      ...project.assetRegistry,
      [asset.id]: asset,
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Adds a clip to a specific track in the project.
 */
export function addClipToTrack(
  project: MediaProject,
  trackId: string,
  clipData: Partial<MediaClip> & { assetId: string }
): { project: MediaProject; clip: MediaClip } {
  const asset = project.assetRegistry[clipData.assetId];
  const clipId = clipData.id || `clip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const defaultDuration = asset?.metadata?.durationSeconds || 5.0;

  const clip: MediaClip = {
    id: clipId,
    name: clipData.name || asset?.name || 'Clip',
    assetId: clipData.assetId,
    type: clipData.type || asset?.type || 'image',
    trim: clipData.trim || (asset?.type === 'video' || asset?.type === 'audio' ? createDefaultTrim(defaultDuration) : undefined),
    timeSlice: clipData.timeSlice || {
      startSeconds: 0,
      durationSeconds: project.kind === 'photo' ? 0 : defaultDuration,
    },
    transform: clipData.transform || createDefaultTransform(),
    volume: clipData.volume ?? 1.0,
    isMuted: clipData.isMuted ?? false,
    operations: clipData.operations || [],
    metadata: clipData.metadata,
  };

  const updatedTracks = project.tracks.map((track) => {
    if (track.id === trackId) {
      return {
        ...track,
        clips: [...track.clips, clip],
      };
    }
    return track;
  });

  const durationSeconds = project.kind === 'video' ? calculateProjectDuration(updatedTracks) : 0;

  return {
    project: {
      ...project,
      tracks: updatedTracks,
      durationSeconds,
      updatedAt: new Date().toISOString(),
    },
    clip,
  };
}

/**
 * Updates a clip's properties across any track.
 */
export function updateClip(
  project: MediaProject,
  clipId: string,
  updates: Partial<MediaClip>
): MediaProject {
  const updatedTracks = project.tracks.map((track) => ({
    ...track,
    clips: track.clips.map((clip) => {
      if (clip.id === clipId) {
        return {
          ...clip,
          ...updates,
          transform: updates.transform ? { ...clip.transform, ...updates.transform } : clip.transform,
          trim: updates.trim ? { ...(clip.trim || createDefaultTrim()), ...updates.trim } : clip.trim,
          timeSlice: updates.timeSlice ? { ...clip.timeSlice, ...updates.timeSlice } : clip.timeSlice,
        };
      }
      return clip;
    }),
  }));

  const durationSeconds = project.kind === 'video' ? calculateProjectDuration(updatedTracks) : 0;

  return {
    ...project,
    tracks: updatedTracks,
    durationSeconds,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Removes a clip from the project.
 */
export function removeClip(project: MediaProject, clipId: string): MediaProject {
  const updatedTracks = project.tracks.map((track) => ({
    ...track,
    clips: track.clips.filter((clip) => clip.id !== clipId),
  }));

  const durationSeconds = project.kind === 'video' ? calculateProjectDuration(updatedTracks) : 0;

  return {
    ...project,
    tracks: updatedTracks,
    durationSeconds,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Adds an operation (filter, AI generation step, adjustment) to project history or clip.
 */
export function applyOperation(
  project: MediaProject,
  clipId: string | null,
  operation: Omit<MediaOperation, 'id' | 'createdAt'>
): MediaProject {
  const now = new Date().toISOString();
  const fullOp: MediaOperation = {
    ...operation,
    id: `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: now,
  };

  if (!clipId) {
    // Project-level operation
    return {
      ...project,
      operationsHistory: [...(project.operationsHistory || []), fullOp],
      updatedAt: now,
    };
  }

  // Clip-level operation
  return updateClip(project, clipId, {
    operations: [
      ...(project.tracks.flatMap((t) => t.clips).find((c) => c.id === clipId)?.operations || []),
      fullOp,
    ],
  });
}
