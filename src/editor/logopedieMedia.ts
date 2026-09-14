import { withBaseUrl } from '../media/baseUrl';
import { LOGOPEDIE_BASIS_PATH } from '../media/logopedie/resolveAvatar';

export const EDITOR_LOGOPEDIE_MEDIA_PATH = '/editor-api/logopedie-media';
export const LOGOPEDIE_MEDIA_PREFIX = 'logopedie/';
export const LOGOPEDIE_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.avif'] as const;

export interface LogopedieMediaItem {
  relativePath: string;
  sizeBytes: number;
}

export type StagedMediaOp =
  | {
      type: 'add' | 'replace';
      relativePath: string;
      file: File;
      previewUrl: string;
      replaceBasis: boolean;
    }
  | { type: 'delete'; relativePath: string };

export function isLogopedieMediaPath(relativePath: string): boolean {
  const normalized = relativePath.replaceAll('\\', '/').replace(/^\/+/, '');
  if (!normalized.startsWith(LOGOPEDIE_MEDIA_PREFIX)) {
    return false;
  }
  if (normalized.includes('..') || normalized.includes('verpleegkunde')) {
    return false;
  }
  return LOGOPEDIE_IMAGE_EXTENSIONS.some((ext) => normalized.toLowerCase().endsWith(ext));
}

export function isErikBasisPath(relativePath: string): boolean {
  return relativePath.replaceAll('\\', '/') === LOGOPEDIE_BASIS_PATH;
}

export function mediaRowTestId(relativePath: string): string {
  return `media-row-${relativePath.replaceAll('/', '_')}`;
}

export async function listLogopedieMedia(): Promise<LogopedieMediaItem[]> {
  const response = await fetch(withBaseUrl(EDITOR_LOGOPEDIE_MEDIA_PATH), { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('De lijst met Logopedie-media kon niet worden geladen.');
  }
  const payload = (await response.json()) as { ok?: boolean; items?: LogopedieMediaItem[] };
  return Array.isArray(payload.items) ? payload.items : [];
}

export async function saveLogopedieMediaOp(op: StagedMediaOp): Promise<void> {
  if (op.type === 'delete') {
    const url = `${withBaseUrl(EDITOR_LOGOPEDIE_MEDIA_PATH)}?path=${encodeURIComponent(op.relativePath)}`;
    const response = await fetch(url, { method: 'DELETE' });
    if (!response.ok) {
      throw new Error(`Verwijderen van ${op.relativePath} is mislukt.`);
    }
    return;
  }
  const buffer = await op.file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const response = await fetch(withBaseUrl(EDITOR_LOGOPEDIE_MEDIA_PATH), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      relativePath: op.relativePath,
      replace: op.type === 'replace',
      replaceBasis: op.replaceBasis,
      contentBase64: btoa(binary),
    }),
  });
  if (!response.ok) {
    let message = `Opslaan van ${op.relativePath} is mislukt.`;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) {
        message = payload.error;
      }
    } catch {
      // keep default
    }
    throw new Error(message);
  }
}

export function applyStagedMedia(
  items: LogopedieMediaItem[],
  staged: StagedMediaOp[],
): Array<LogopedieMediaItem & { previewUrl?: string; stagedType?: StagedMediaOp['type'] }> {
  const next = new Map(
    items.map((item) => [
      item.relativePath,
      { ...item } as LogopedieMediaItem & {
        previewUrl?: string;
        stagedType?: StagedMediaOp['type'];
      },
    ]),
  );
  for (const op of staged) {
    if (op.type === 'delete') {
      next.delete(op.relativePath);
      continue;
    }
    next.set(op.relativePath, {
      relativePath: op.relativePath,
      sizeBytes: op.file.size,
      previewUrl: op.previewUrl,
      stagedType: op.type,
    });
  }
  return [...next.values()].sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'nl'));
}
