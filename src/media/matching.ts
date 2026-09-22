import { withBaseUrl } from './baseUrl';
import { mediaManifest } from './generated/media-manifest';
import type { MediaFileType, MediaManifestItem, MediaSlotConfig, TrainingModule } from './types';

function withPublicBase(item: MediaManifestItem): MediaManifestItem {
  return { ...item, publicUrl: withBaseUrl(item.publicUrl) };
}

export function listModuleMedia(moduleId: TrainingModule): MediaManifestItem[] {
  return mediaManifest.items
    .filter((item) => item.module === moduleId)
    .map((item) => withPublicBase(item as MediaManifestItem));
}

export function findByRelativePath(relativePath: string): MediaManifestItem | undefined {
  const item = mediaManifest.items.find((entry) => entry.relativePath === relativePath) as
    MediaManifestItem | undefined;
  return item ? withPublicBase(item) : undefined;
}

export function scoreMediaItem(item: MediaManifestItem, keywords: string[]): number {
  const wanted = new Set(keywords.map((word) => word.toLowerCase()));
  let score = 0;
  for (const keyword of item.keywords) {
    if (wanted.has(keyword)) {
      score += 2;
    }
  }
  for (const word of wanted) {
    if (item.normalizedName.includes(word)) {
      score += 1;
    }
  }
  return score;
}

export function rankCandidates(
  moduleId: TrainingModule,
  keywords: string[],
  fileType: 'video' | 'image' | 'any' = 'video',
): MediaManifestItem[] {
  const pool = listModuleMedia(moduleId).filter(
    (item) => fileType === 'any' || item.fileType === fileType,
  );
  return [...pool].sort((a, b) => {
    const delta = scoreMediaItem(b, keywords) - scoreMediaItem(a, keywords);
    if (delta !== 0) {
      return delta;
    }
    return a.relativePath.localeCompare(b.relativePath, 'nl');
  });
}

export function pickPrimary(
  moduleId: TrainingModule,
  keywords: string[],
  overridePath?: string,
): { primary: MediaManifestItem | null; alternatives: MediaManifestItem[] } {
  if (overridePath) {
    const override = findByRelativePath(overridePath);
    if (override && override.module === moduleId) {
      const rest = rankCandidates(moduleId, keywords).filter(
        (item) => item.relativePath !== override.relativePath,
      );
      return { primary: override, alternatives: rest };
    }
  }
  const ranked = rankCandidates(moduleId, keywords);
  const primary = ranked[0] && scoreMediaItem(ranked[0], keywords) > 0 ? ranked[0] : null;
  return {
    primary,
    alternatives: ranked.filter((item) => item.relativePath !== primary?.relativePath),
  };
}

function fileTypeFromPath(relativePath: string): MediaFileType {
  const ext = relativePath.slice(relativePath.lastIndexOf('.')).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.webp', '.avif', '.svg'].includes(ext)) {
    return 'image';
  }
  return 'video';
}

export function mediaItemFromRelativePath(
  relativePath: string,
  moduleId: TrainingModule,
): MediaManifestItem {
  const fromCatalog = findByRelativePath(relativePath);
  if (fromCatalog) {
    return fromCatalog;
  }
  const ext = relativePath.includes('.') ? relativePath.slice(relativePath.lastIndexOf('.')) : '';
  return {
    relativePath,
    module: moduleId,
    fileType: fileTypeFromPath(relativePath),
    extension: ext,
    sizeBytes: 0,
    normalizedName: relativePath.toLowerCase(),
    keywords: [],
    durationSeconds: null,
    width: null,
    height: null,
    publicUrl: withBaseUrl(
      `/resources/${relativePath
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/')}`,
    ),
    warnings: [],
  };
}

function alternativesFor(slot: MediaSlotConfig): MediaManifestItem[] {
  return slot.alternativeMatches
    .map((path) => findByRelativePath(path))
    .filter((item): item is MediaManifestItem => Boolean(item));
}

export function resolveSlot(
  slot: MediaSlotConfig,
  overridePath?: string,
): {
  media: MediaManifestItem | null;
  alternatives: MediaManifestItem[];
} {
  if (overridePath) {
    const override = findByRelativePath(overridePath);
    if (override && override.module === slot.module) {
      return {
        media: override,
        alternatives: alternativesFor(slot),
      };
    }
    if (overridePath.replaceAll('\\', '/').startsWith(`${slot.module}/`)) {
      return {
        media: mediaItemFromRelativePath(overridePath, slot.module),
        alternatives: alternativesFor(slot),
      };
    }
  }
  if (slot.primaryMedia) {
    const configured = findByRelativePath(slot.primaryMedia);
    if (configured) {
      return {
        media: configured,
        alternatives: alternativesFor(slot),
      };
    }
    if (slot.primaryMedia.replaceAll('\\', '/').startsWith(`${slot.module}/`)) {
      return {
        media: mediaItemFromRelativePath(slot.primaryMedia, slot.module),
        alternatives: alternativesFor(slot),
      };
    }
  }
  const picked = pickPrimary(slot.module, slot.matchedKeywords);
  return { media: picked.primary, alternatives: picked.alternatives };
}
