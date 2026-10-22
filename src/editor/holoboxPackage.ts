import { withBaseUrl } from '../media/baseUrl';
import type { NursingScenario } from '../nursing/types';
import { isNursingMediaPath } from './nursingMedia';
import { holoboxStartPrefix, holoboxZipRelative, isHoloboxVideoPath } from './holoboxPackagePaths';
import {
  isQuestionFolderPath,
  QUESTION_TEXT_FILES,
  questionTextFiles,
  resolvedQuestionFolder,
  startVideoRelative,
} from './questionFolder';
import { selectHoloboxImportFiles, type HoloboxImportFile } from './holoboxImportPaths';
import { unzipStore, zipStore, type ZipEntry } from './zipStore';

export {
  holoboxExportFileName,
  holoboxZipRelative,
  isHoloboxVideoPath,
  safeHoloboxPackageTitle,
} from './holoboxPackagePaths';

export const HOLOBOX_PACKAGE_SCHEMA_VERSION = 1;
export const HOLOBOX_PACKAGE_KIND = 'phosaner-holobox-pakket';
export const HOLOBOX_PACKAGE_META = 'phosaner-holobox.json';
export const HOLOBOX_PACKAGE_PAYLOAD = 'inhoud.bin';
export const HOLOBOX_PACKAGE_PATH = '/editor-api/holobox-package';
export const HOLOBOX_PACKAGE_FILES_PATH = '/editor-api/holobox-package-files';
export const HOLOBOX_IMPORT_PATH = '/editor-api/import-holobox';
export const HOLOBOX_KDF_ITERATIONS = 210_000;
/** Sleutel die de student-app zelf gebruikt. Studenten typen hem niet. */
export const HOLOBOX_PACKAGE_KEY = 'b4e9c1a7f03d48e6a2c5d8f17b90e3a6c4d1f8a27e5b0c93';

export interface HoloboxPackageFile {
  name: string;
  data: Uint8Array;
}

interface HoloboxPackageMeta {
  schemaVersion: 1;
  kind: typeof HOLOBOX_PACKAGE_KIND;
  kdf: 'PBKDF2-SHA-256';
  cipher: 'AES-GCM';
  iterations: number;
  salt: string;
  iv: string;
}

export function safeCaseFileName(fileName: string | null): string {
  const base = (fileName ?? '').replaceAll('\\', '/').split('/').pop()?.trim() ?? '';
  if (
    base.includes('..') ||
    (!base.startsWith('verpleegkunde-') && base !== 'verpleegkunde.json') ||
    !base.endsWith('.json')
  ) {
    return 'verpleegkunde.json';
  }
  return base;
}

function copyBytes(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/.test(hex)) {
    return null;
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function normalizeZipName(value: string): string | null {
  const name = value.replaceAll('\\', '/').replace(/^\/+/, '');
  if (!name || name.includes('..') || name.endsWith('/')) {
    return null;
  }
  return name;
}

function isPackagedVideo(name: string): boolean {
  return (
    name.startsWith('gesprekstechnieken/') && isNursingMediaPath(name) && isHoloboxVideoPath(name)
  );
}

function videoBelongsToCase(scenario: NursingScenario, name: string): boolean {
  const folders = scenario.steps
    .map((step) => resolvedQuestionFolder(scenario.meta.title, step))
    .filter((folder) => isQuestionFolderPath(folder) && folder.startsWith('gesprekstechnieken/'));
  if (folders.some((folder) => name.startsWith(`${folder}/Videos/`))) {
    return true;
  }
  const dashed = holoboxStartPrefix(scenario.meta.title);
  if (dashed && name.startsWith(`gesprekstechnieken/Startvideos/${dashed}-Vraag`)) {
    return true;
  }
  for (const step of scenario.steps) {
    if (startVideoRelative(scenario.meta.title, step.stepName ?? '') === name) {
      return true;
    }
  }
  return scenario.mediaSlots.some((slot) => slot.primaryMedia?.replaceAll('\\', '/') === name);
}

export function openCasePackageFiles(
  scenario: NursingScenario,
  caseFileName: string,
  envelopeText: string,
  diskFiles: Array<{ relativePath: string; data: Uint8Array }>,
): HoloboxPackageFile[] {
  const files = new Map<string, Uint8Array>();
  for (const file of diskFiles) {
    const name = normalizeZipName(file.relativePath);
    if (!name || !isPackagedVideo(name) || !videoBelongsToCase(scenario, name)) {
      continue;
    }
    files.set(name, file.data);
  }
  for (const step of scenario.steps) {
    const folder = resolvedQuestionFolder(scenario.meta.title, step);
    if (!isQuestionFolderPath(folder) || !folder.startsWith('gesprekstechnieken/')) {
      continue;
    }
    const texts = questionTextFiles(step);
    for (const textName of QUESTION_TEXT_FILES) {
      files.set(`${folder}/${textName}`, new TextEncoder().encode(texts[textName]));
    }
  }
  const envelope = envelopeText.endsWith('\n') ? envelopeText : `${envelopeText}\n`;
  files.set(`scenarios/${safeCaseFileName(caseFileName)}`, new TextEncoder().encode(envelope));
  return [...files.entries()]
    .sort((left, right) => (left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0))
    .map(([name, data]) => ({ name, data }));
}

function iterationCount(value: number): number | null {
  if (!Number.isInteger(value) || value < 1 || value > 2_000_000) {
    return null;
  }
  return value;
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    copyBytes(new TextEncoder().encode(password)),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: copyBytes(salt), iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function packageMeta(entries: ZipEntry[]): HoloboxPackageMeta | null {
  const metaEntry = entries.find((entry) => entry.name === HOLOBOX_PACKAGE_META);
  if (!metaEntry) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      new TextDecoder().decode(metaEntry.data),
    ) as Partial<HoloboxPackageMeta>;
    const iterations = iterationCount(parsed.iterations ?? 0);
    const saltHex = typeof parsed.salt === 'string' ? parsed.salt : '';
    const ivHex = typeof parsed.iv === 'string' ? parsed.iv : '';
    const salt = hexToBytes(saltHex);
    const iv = hexToBytes(ivHex);
    if (
      parsed.schemaVersion !== HOLOBOX_PACKAGE_SCHEMA_VERSION ||
      parsed.kind !== HOLOBOX_PACKAGE_KIND ||
      parsed.kdf !== 'PBKDF2-SHA-256' ||
      parsed.cipher !== 'AES-GCM' ||
      !iterations ||
      !salt ||
      salt.length !== 16 ||
      !iv ||
      iv.length !== 12
    ) {
      return null;
    }
    return {
      schemaVersion: 1,
      kind: HOLOBOX_PACKAGE_KIND,
      kdf: 'PBKDF2-SHA-256',
      cipher: 'AES-GCM',
      iterations,
      salt: saltHex,
      iv: ivHex,
    };
  } catch {
    return null;
  }
}

/** De buitenste zip bevat alleen cijfertekst. Uitpakken zonder wachtwoord levert de casus niet. */
export async function encryptHoloboxPackage(
  files: HoloboxPackageFile[],
  password: string,
  options?: { iterations?: number },
): Promise<Uint8Array> {
  if (password.length === 0) {
    throw new Error('Het editorwachtwoord ontbreekt.');
  }
  const iterations = iterationCount(options?.iterations ?? HOLOBOX_KDF_ITERATIONS);
  if (!iterations) {
    throw new Error('Het pakket kon niet worden versleuteld.');
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, iterations);
  const inner = zipStore(files.map((file) => ({ name: file.name, data: file.data })));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: copyBytes(iv) }, key, copyBytes(inner)),
  );
  const meta: HoloboxPackageMeta = {
    schemaVersion: HOLOBOX_PACKAGE_SCHEMA_VERSION,
    kind: HOLOBOX_PACKAGE_KIND,
    kdf: 'PBKDF2-SHA-256',
    cipher: 'AES-GCM',
    iterations,
    salt: bytesToHex(salt),
    iv: bytesToHex(iv),
  };
  return zipStore([
    {
      name: HOLOBOX_PACKAGE_META,
      data: new TextEncoder().encode(`${JSON.stringify(meta)}\n`),
    },
    { name: HOLOBOX_PACKAGE_PAYLOAD, data: cipher },
  ]);
}

export async function decryptHoloboxPackage(
  outerZip: Uint8Array,
  password: string,
): Promise<{ ok: true; files: HoloboxPackageFile[] } | { ok: false; error: string }> {
  if (password.length === 0) {
    return { ok: false, error: 'Het editorwachtwoord ontbreekt.' };
  }
  let entries: ZipEntry[];
  try {
    entries = unzipStore(outerZip);
  } catch {
    return { ok: false, error: 'Het pakket is geen zip.' };
  }
  const meta = packageMeta(entries);
  const payload = entries.find((entry) => entry.name === HOLOBOX_PACKAGE_PAYLOAD);
  if (!meta || !payload) {
    return { ok: false, error: 'Het pakket is ongeldig.' };
  }
  const salt = hexToBytes(meta.salt);
  const iv = hexToBytes(meta.iv);
  if (!salt || !iv) {
    return { ok: false, error: 'Het pakket is ongeldig.' };
  }
  try {
    const key = await deriveKey(password, salt, meta.iterations);
    const plain = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: copyBytes(iv) },
        key,
        copyBytes(payload.data),
      ),
    );
    const files = unzipStore(plain).map((entry) => ({ name: entry.name, data: entry.data }));
    return { ok: true, files };
  } catch {
    return { ok: false, error: 'Het wachtwoord klopt niet of het pakket is beschadigd.' };
  }
}

export async function storeHoloboxImport(
  files: HoloboxImportFile[],
  replace: boolean,
): Promise<{ ok: true; caseFile: string } | { ok: false; error: string; exists?: boolean }> {
  const planned = selectHoloboxImportFiles(files);
  if (!planned.ok) {
    return planned;
  }
  try {
    const zip = zipStore(planned.files.map((file) => ({ name: file.name, data: file.data })));
    const response = await fetch(withBaseUrl(HOLOBOX_IMPORT_PATH), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/zip',
        'X-Holobox-Replace': replace ? '1' : '0',
      },
      body: new Blob([copyBytes(zip)]),
    });
    const payload = (await response.json()) as {
      ok?: boolean;
      error?: string;
      exists?: boolean;
      caseFile?: string;
    };
    if (response.status === 409 || payload.exists) {
      return {
        ok: false,
        exists: true,
        error: payload.error ?? 'Er bestaat al een casus met deze naam.',
      };
    }
    if (!response.ok || !payload.ok || !payload.caseFile) {
      return { ok: false, error: payload.error ?? 'De casus kon niet worden geïmporteerd.' };
    }
    return { ok: true, caseFile: payload.caseFile };
  } catch {
    return {
      ok: false,
      error: 'Importeren is niet beschikbaar. Start de bewerker via Editor.exe of npm run dev.',
    };
  }
}

export async function fetchHoloboxPackageStatus(
  title: string,
): Promise<{ ok: true; exists: boolean; zip: string } | { ok: false; error: string }> {
  const zip = holoboxZipRelative(title);
  if (!zip) {
    return { ok: false, error: 'De casus heeft geen naam voor een pakket.' };
  }
  try {
    const response = await fetch(
      withBaseUrl(`${HOLOBOX_PACKAGE_PATH}?name=${encodeURIComponent(title)}`),
      { cache: 'no-store' },
    );
    const payload = (await response.json()) as {
      ok?: boolean;
      exists?: boolean;
      error?: string;
      zip?: string;
    };
    if (!response.ok || !payload.ok || typeof payload.exists !== 'boolean') {
      return { ok: false, error: payload.error ?? 'Het pakket kon niet worden gecontroleerd.' };
    }
    return { ok: true, exists: payload.exists, zip: payload.zip || zip };
  } catch {
    return {
      ok: false,
      error: 'Pakket maken is niet beschikbaar. Start de bewerker via Editor.exe of npm run dev.',
    };
  }
}

export async function fetchHoloboxDiskFiles(
  title: string,
  folders: string[],
  extraVideos: string[],
): Promise<{ ok: true; files: string[] } | { ok: false; error: string }> {
  try {
    const response = await fetch(withBaseUrl(HOLOBOX_PACKAGE_FILES_PATH), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, folders, extraVideos }),
    });
    const payload = (await response.json()) as {
      ok?: boolean;
      error?: string;
      files?: unknown;
    };
    if (!response.ok || !payload.ok || !Array.isArray(payload.files)) {
      return {
        ok: false,
        error: payload.error ?? 'De bestanden van de casus konden niet worden gelezen.',
      };
    }
    return {
      ok: true,
      files: payload.files.filter((item): item is string => typeof item === 'string'),
    };
  } catch {
    return {
      ok: false,
      error: 'Pakket maken is niet beschikbaar. Start de bewerker via Editor.exe of npm run dev.',
    };
  }
}

export async function storeHoloboxPackage(
  title: string,
  zip: Uint8Array,
  replace: boolean,
): Promise<
  { ok: true; zip: string; replaced: boolean } | { ok: false; error: string; exists?: boolean }
> {
  try {
    const response = await fetch(withBaseUrl(HOLOBOX_PACKAGE_PATH), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/zip',
        'X-Holobox-Name': encodeURIComponent(title),
        'X-Holobox-Replace': replace ? '1' : '0',
      },
      body: new Blob([copyBytes(zip)]),
    });
    const payload = (await response.json()) as {
      ok?: boolean;
      error?: string;
      zip?: string;
      exists?: boolean;
      replaced?: boolean;
    };
    if (response.status === 409 || payload.exists) {
      return {
        ok: false,
        exists: true,
        error: payload.error ?? 'Er bestaat al een pakket met deze casusnaam.',
      };
    }
    if (!response.ok || !payload.ok || !payload.zip) {
      return { ok: false, error: payload.error ?? 'Het pakket kon niet worden opgeslagen.' };
    }
    return { ok: true, zip: payload.zip, replaced: payload.replaced === true };
  } catch {
    return {
      ok: false,
      error: 'Pakket maken is niet beschikbaar. Start de bewerker via Editor.exe of npm run dev.',
    };
  }
}
