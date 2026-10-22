export const HOLOBOX_PACKAGE_DIR = 'pakketten';

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v'] as const;
const RESERVED_FILE_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

function hasForbiddenFileCharacter(value: string): boolean {
  if (/[<>:"/\\|?*]/.test(value)) {
    return true;
  }
  for (const char of value) {
    if (char.charCodeAt(0) < 32) {
      return true;
    }
  }
  return false;
}

export function safeHoloboxPackageTitle(title: string): string | null {
  const trimmed = title.trim();
  if (
    !trimmed ||
    trimmed === '.' ||
    trimmed === '..' ||
    trimmed.length > 120 ||
    trimmed.endsWith('.') ||
    trimmed.endsWith(' ') ||
    RESERVED_FILE_NAME.test(trimmed) ||
    hasForbiddenFileCharacter(trimmed)
  ) {
    return null;
  }
  return trimmed;
}

export function holoboxZipRelative(title: string, previous = false): string | null {
  const safe = safeHoloboxPackageTitle(title);
  if (!safe) {
    return null;
  }
  return previous
    ? `${HOLOBOX_PACKAGE_DIR}/vorige/${safe}.zip`
    : `${HOLOBOX_PACKAGE_DIR}/${safe}.zip`;
}

/** Bestandsnaam van een nieuw pakket: het exporteermoment, zonder dubbele punt. */
export function holoboxExportFileName(at = new Date()): string | null {
  const pad = (value: number) => String(value).padStart(2, '0');
  const date = `${pad(at.getDate())}-${pad(at.getMonth() + 1)}-${at.getFullYear()}`;
  const time = `${pad(at.getHours())}-${pad(at.getMinutes())}`;
  return safeHoloboxPackageTitle(`Export ${date} ${time}`);
}

export function isHoloboxVideoPath(relativePath: string): boolean {
  const normalized = relativePath.replaceAll('\\', '/').toLowerCase();
  return VIDEO_EXTENSIONS.some((extension) => normalized.endsWith(extension));
}

function isUnsafeFolderChar(char: string): boolean {
  const code = char.charCodeAt(0);
  return code < 32 || '<>:"/\\|?*'.includes(char);
}

/** Zelfde mapnaam als de vraagmap, met streepjes voor de startvideobestandsnaam. */
export function holoboxStartPrefix(title: string): string {
  let cleaned = '';
  for (const char of title.trim()) {
    cleaned += isUnsafeFolderChar(char) ? ' ' : char;
  }
  cleaned = cleaned.replace(/\.\./g, ' ').replace(/\s+/g, ' ').trim();
  return (cleaned || 'scenario').replace(/ /g, '-');
}
