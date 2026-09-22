import { withBaseUrl } from '../media/baseUrl';

export const EDITOR_NURSING_MEDIA_PATH = '/editor-api/verpleegkunde-media';
export const NURSING_MEDIA_PREFIX = 'verpleegkunde/';
export const NURSING_MEDIA_EXTENSIONS = [
  '.mp4',
  '.webm',
  '.mov',
  '.m4v',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.avif',
] as const;

export interface NursingMediaItem {
  relativePath: string;
  sizeBytes: number;
}

export type StagedNursingMediaOp =
  | {
      type: 'add' | 'replace';
      relativePath: string;
      file: File;
      previewUrl: string;
    }
  | { type: 'delete'; relativePath: string };

export function isNursingMediaPath(relativePath: string): boolean {
  const normalized = relativePath.replaceAll('\\', '/').replace(/^\/+/, '');
  if (!normalized.startsWith(NURSING_MEDIA_PREFIX)) {
    return false;
  }
  if (normalized.includes('..') || normalized.includes('logopedie')) {
    return false;
  }
  return NURSING_MEDIA_EXTENSIONS.some((ext) => normalized.toLowerCase().endsWith(ext));
}

export function nursingMediaRowTestId(relativePath: string): string {
  return `nursing-media-row-${relativePath.replaceAll('/', '_')}`;
}

export async function listNursingMedia(): Promise<NursingMediaItem[]> {
  const response = await fetch(withBaseUrl(EDITOR_NURSING_MEDIA_PATH), { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('De lijst met Verpleegkunde-media kon niet worden geladen.');
  }
  const payload = (await response.json()) as { ok?: boolean; items?: NursingMediaItem[] };
  return Array.isArray(payload.items) ? payload.items : [];
}

export async function saveNursingMediaOp(op: StagedNursingMediaOp): Promise<void> {
  if (op.type === 'delete') {
    const url = `${withBaseUrl(EDITOR_NURSING_MEDIA_PATH)}?path=${encodeURIComponent(op.relativePath)}`;
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
  const response = await fetch(withBaseUrl(EDITOR_NURSING_MEDIA_PATH), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      relativePath: op.relativePath,
      replace: op.type === 'replace',
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

export function applyStagedNursingMedia(
  items: NursingMediaItem[],
  staged: StagedNursingMediaOp[],
): Array<NursingMediaItem & { previewUrl?: string; stagedType?: StagedNursingMediaOp['type'] }> {
  const next = new Map(
    items.map((item) => [
      item.relativePath,
      { ...item } as NursingMediaItem & {
        previewUrl?: string;
        stagedType?: StagedNursingMediaOp['type'];
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
