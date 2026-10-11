import { isHoloboxVideoPath } from '../editor/holoboxPackagePaths';

const urls = new Map<string, string>();

function mediaKey(relativePath: string): string {
  return relativePath.replaceAll('\\', '/').replace(/^\/+/, '');
}

function videoType(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.webm')) {
    return 'video/webm';
  }
  if (lower.endsWith('.mov')) {
    return 'video/quicktime';
  }
  if (lower.endsWith('.m4v')) {
    return 'video/x-m4v';
  }
  return 'video/mp4';
}

export function rememberPackageMedia(files: Array<{ name: string; data: Uint8Array }>): void {
  releasePackageMedia();
  if (typeof URL.createObjectURL !== 'function') {
    return;
  }
  for (const file of files) {
    const name = mediaKey(file.name);
    if (!isHoloboxVideoPath(name)) {
      continue;
    }
    const copy = new Uint8Array(file.data);
    urls.set(name, URL.createObjectURL(new Blob([copy], { type: videoType(name) })));
  }
}

export function packageMediaUrl(relativePath: string): string | null {
  return urls.get(mediaKey(relativePath)) ?? null;
}

export function releasePackageMedia(): void {
  if (typeof URL.revokeObjectURL === 'function') {
    for (const url of urls.values()) {
      URL.revokeObjectURL(url);
    }
  }
  urls.clear();
}
