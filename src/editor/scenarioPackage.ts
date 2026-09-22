import type { Scenario } from '../domain/types';
import { withBaseUrl } from '../media/baseUrl';
import type { NursingScenario } from '../nursing/types';
import { envelopeJson, parseLogopedieEnvelope } from './envelope';
import { isLogopedieMediaPath } from './logopedieMedia';
import { nursingEnvelopeJson, parseVerpleegkundeEnvelope } from './nursingEnvelope';
import { isNursingMediaPath } from './nursingMedia';
import { logopedieSaveIssues, nursingSaveIssues } from './saveChecks';
import { unzipStore, zipStore, type ZipEntry } from './zipStore';

export const EDITOR_PACKAGE_SCHEMA_VERSION = 1;
export const EDITOR_PACKAGE_KIND = 'holobox-editor-package';
export const EDITOR_EXPORT_PATH = '/editor-api/export-package';
export const EDITOR_EXPORT_FILE_PATH = '/editor-api/export-file';
export const EDITOR_IMPORT_MEDIA_PATH = '/editor-api/import-media';
export const PACKAGE_MANIFEST_FILE = 'holobox-package.json';

export type EditorPackageModule = 'logopedie' | 'verpleegkunde';

export interface EditorPackageManifest {
  schemaVersion: 1;
  kind: 'holobox-editor-package';
  module: EditorPackageModule;
  exportedAt: string;
}

export interface PackageMediaFile {
  relativePath: string;
  data: Uint8Array;
}

export type ParsedEditorPackage =
  | {
      ok: true;
      module: 'logopedie';
      scenario: Scenario;
      envelopeText: string;
      media: PackageMediaFile[];
    }
  | {
      ok: true;
      module: 'verpleegkunde';
      scenario: NursingScenario;
      envelopeText: string;
      media: PackageMediaFile[];
    }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function packageManifest(
  moduleId: EditorPackageModule,
  at = new Date(),
): EditorPackageManifest {
  return {
    schemaVersion: EDITOR_PACKAGE_SCHEMA_VERSION,
    kind: EDITOR_PACKAGE_KIND,
    module: moduleId,
    exportedAt: at.toISOString(),
  };
}

export function scenarioFileName(moduleId: EditorPackageModule): string {
  return moduleId === 'logopedie' ? 'logopedie.json' : 'verpleegkunde.json';
}

export function mediaZipPath(relativePath: string): string {
  return `media/${relativePath.replaceAll('\\', '/')}`;
}

function decodeText(data: Uint8Array): string {
  return new TextDecoder().decode(data);
}

export function parseEditorPackageEntries(entries: ZipEntry[]): ParsedEditorPackage {
  const files = new Map(entries.map((entry) => [entry.name.replaceAll('\\', '/'), entry]));
  const manifestEntry = files.get(PACKAGE_MANIFEST_FILE);
  let moduleId: EditorPackageModule | null = null;
  if (manifestEntry) {
    try {
      const manifest = JSON.parse(decodeText(manifestEntry.data)) as {
        schemaVersion?: unknown;
        kind?: unknown;
        module?: unknown;
      };
      if (manifest.schemaVersion !== EDITOR_PACKAGE_SCHEMA_VERSION) {
        return { ok: false, error: 'Pakket-schemaVersion moet 1 zijn.' };
      }
      if (manifest.kind !== EDITOR_PACKAGE_KIND) {
        return { ok: false, error: 'Dit is geen Holobox-editorpakket.' };
      }
      if (manifest.module !== 'logopedie' && manifest.module !== 'verpleegkunde') {
        return { ok: false, error: 'Pakketmodule moet logopedie of verpleegkunde zijn.' };
      }
      moduleId = manifest.module;
    } catch {
      return { ok: false, error: 'Pakket-manifest is geen geldige JSON.' };
    }
  }
  const logopedieJson = files.get('logopedie.json');
  const nursingJson = files.get('verpleegkunde.json');
  if (!moduleId) {
    if (logopedieJson && !nursingJson) {
      moduleId = 'logopedie';
    } else if (nursingJson && !logopedieJson) {
      moduleId = 'verpleegkunde';
    } else {
      return { ok: false, error: 'Pakket mist logopedie.json of verpleegkunde.json.' };
    }
  }
  const envelopeEntry = files.get(scenarioFileName(moduleId));
  if (!envelopeEntry) {
    return { ok: false, error: `Pakket mist ${scenarioFileName(moduleId)}.` };
  }
  const envelopeText = decodeText(envelopeEntry.data);
  const media: PackageMediaFile[] = [];
  for (const entry of entries) {
    const name = entry.name.replaceAll('\\', '/');
    if (!name.startsWith('media/') || name.endsWith('/')) {
      continue;
    }
    const relativePath = name.slice('media/'.length);
    if (moduleId === 'logopedie') {
      if (!isLogopedieMediaPath(relativePath)) {
        return { ok: false, error: `Ongeldig Logopedie-mediapad: ${relativePath}` };
      }
    } else if (!isNursingMediaPath(relativePath)) {
      return { ok: false, error: `Ongeldig Verpleegkunde-mediapad: ${relativePath}` };
    }
    media.push({ relativePath, data: entry.data });
  }
  if (moduleId === 'logopedie') {
    const parsed = parseLogopedieEnvelope(envelopeText);
    if (!parsed.ok) {
      return { ok: false, error: parsed.error };
    }
    return {
      ok: true,
      module: 'logopedie',
      scenario: parsed.scenario,
      envelopeText,
      media,
    };
  }
  const parsed = parseVerpleegkundeEnvelope(envelopeText);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }
  return {
    ok: true,
    module: 'verpleegkunde',
    scenario: parsed.scenario,
    envelopeText,
    media,
  };
}

export function parseEditorPackageZip(buffer: Uint8Array): ParsedEditorPackage {
  try {
    return parseEditorPackageEntries(unzipStore(buffer));
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Het zip-pakket kon niet worden gelezen.',
    };
  }
}

export function editorPackageIssues(parsed: Exclude<ParsedEditorPackage, { ok: false }>): string[] {
  return parsed.module === 'logopedie'
    ? logopedieSaveIssues(parsed.scenario)
    : nursingSaveIssues(parsed.scenario);
}

export function buildEditorPackageZip(
  moduleId: EditorPackageModule,
  envelopeText: string,
  media: PackageMediaFile[],
  at = new Date(),
): Uint8Array {
  const entries: ZipEntry[] = [
    {
      name: PACKAGE_MANIFEST_FILE,
      data: new TextEncoder().encode(`${JSON.stringify(packageManifest(moduleId, at), null, 2)}\n`),
    },
    {
      name: scenarioFileName(moduleId),
      data: new TextEncoder().encode(
        envelopeText.endsWith('\n') ? envelopeText : `${envelopeText}\n`,
      ),
    },
  ];
  for (const file of media) {
    entries.push({ name: mediaZipPath(file.relativePath), data: file.data });
  }
  return zipStore(entries);
}

export function envelopeTextForModule(
  moduleId: EditorPackageModule,
  draft: Scenario | NursingScenario,
): string {
  return moduleId === 'logopedie'
    ? envelopeJson(draft as Scenario)
    : nursingEnvelopeJson(draft as NursingScenario);
}

function bytesToBase64(data: Uint8Array): string {
  let binary = '';
  for (const byte of data) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export async function exportPackageToCopy(
  moduleId: EditorPackageModule,
  envelopeText: string,
  extraMedia: Array<{ relativePath: string; contentBase64: string }> = [],
): Promise<{ ok: true; folder: string; zip: string } | { ok: false; error: string }> {
  try {
    const response = await fetch(withBaseUrl(EDITOR_EXPORT_PATH), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        module: moduleId,
        envelopeText,
        extraMedia,
      }),
    });
    const payload = (await response.json()) as {
      ok?: boolean;
      error?: string;
      folder?: string;
      zip?: string;
    };
    if (!response.ok || !payload.ok || !payload.folder || !payload.zip) {
      return { ok: false, error: payload.error ?? 'Exporteren is mislukt.' };
    }
    return { ok: true, folder: payload.folder, zip: payload.zip };
  } catch {
    return {
      ok: false,
      error: 'Exporteren is niet beschikbaar. Start de bewerker via Editor.exe of npm run dev.',
    };
  }
}

export async function importPackageMedia(
  moduleId: EditorPackageModule,
  media: PackageMediaFile[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch(withBaseUrl(EDITOR_IMPORT_MEDIA_PATH), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        module: moduleId,
        files: media.map((item) => ({
          relativePath: item.relativePath,
          contentBase64: bytesToBase64(item.data),
        })),
      }),
    });
    const payload = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok || !payload.ok) {
      return {
        ok: false,
        error: payload.error ?? 'Media uit het pakket konden niet worden gezet.',
      };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: 'Importeren is niet beschikbaar. Start de bewerker via Editor.exe of npm run dev.',
    };
  }
}

export function suggestedZipName(zipPath: string): string {
  const name = zipPath.replaceAll('\\', '/').split('/').pop()?.trim() || 'holobox-pakket.zip';
  return name.toLowerCase().endsWith('.zip') ? name : `${name}.zip`;
}

function isAbortError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'name' in error &&
    (error as { name: string }).name === 'AbortError',
  );
}

function automatedBrowser(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.webdriver);
}

export async function saveExportedZipAs(
  zipRelativePath: string,
): Promise<'saved' | 'cancelled' | 'skipped'> {
  const picker = window.showSaveFilePicker;
  if (typeof picker !== 'function' || automatedBrowser()) {
    return 'skipped';
  }
  try {
    const handle = await picker({
      suggestedName: suggestedZipName(zipRelativePath),
      types: [
        {
          description: 'Holobox-pakket',
          accept: { 'application/zip': ['.zip'] },
        },
      ],
    });
    const response = await fetch(
      withBaseUrl(`${EDITOR_EXPORT_FILE_PATH}?path=${encodeURIComponent(zipRelativePath)}`),
    );
    if (!response.ok) {
      return 'skipped';
    }
    const writable = await handle.createWritable();
    await writable.write(await response.arrayBuffer());
    await writable.close();
    return 'saved';
  } catch (error) {
    return isAbortError(error) ? 'cancelled' : 'skipped';
  }
}

export async function pickZipFileToImport(): Promise<File | 'cancelled' | 'fallback'> {
  const picker = window.showOpenFilePicker;
  if (typeof picker !== 'function' || automatedBrowser()) {
    return 'fallback';
  }
  try {
    const handles = await picker({
      multiple: false,
      types: [
        {
          description: 'Holobox-pakket',
          accept: { 'application/zip': ['.zip'] },
        },
      ],
    });
    const handle = handles[0];
    if (!handle) {
      return 'cancelled';
    }
    return await handle.getFile();
  } catch (error) {
    return isAbortError(error) ? 'cancelled' : 'fallback';
  }
}

export function isPackageManifest(value: unknown): value is EditorPackageManifest {
  return (
    isRecord(value) &&
    value.schemaVersion === EDITOR_PACKAGE_SCHEMA_VERSION &&
    value.kind === EDITOR_PACKAGE_KIND &&
    (value.module === 'logopedie' || value.module === 'verpleegkunde')
  );
}
