import { safeHoloboxPackageTitle, holoboxZipRelative } from '../editor/holoboxPackagePaths';
import {
  decryptHoloboxPackage,
  HOLOBOX_PACKAGE_KEY,
  type HoloboxPackageFile,
} from '../editor/holoboxPackage';
import { parseVerpleegkundeEnvelope } from '../editor/nursingEnvelope';
import { nursingSaveIssues } from '../editor/saveChecks';
import { withBaseUrl } from '../media/baseUrl';
import { rememberPackageMedia } from '../media/packageMedia';
import type { NursingScenario } from '../nursing/types';

export interface HoloboxPackageListing {
  file: string;
  title: string;
  zip: string;
}

const caseTitleCache = new Map<string, Promise<string | null>>();

async function readHoloboxCaseTitle(bytes: Uint8Array): Promise<string | null> {
  const opened = await decryptHoloboxPackage(bytes, HOLOBOX_PACKAGE_KEY);
  if (!opened.ok) {
    return null;
  }
  const text = caseText(opened.files);
  if (!text) {
    return null;
  }
  const parsed = parseVerpleegkundeEnvelope(text);
  if (!parsed.ok) {
    return null;
  }
  const title = parsed.scenario.meta.title.trim();
  return title || null;
}

async function caseTitleForFile(
  file: string,
  fetchFn: typeof fetch,
  useCache: boolean,
): Promise<string | null> {
  const load = async (): Promise<string | null> => {
    try {
      const response = await fetchFn(
        withBaseUrl(`/app-api/holobox-package?name=${encodeURIComponent(file)}`),
        { cache: 'no-store' },
      );
      if (!response.ok) {
        return null;
      }
      return readHoloboxCaseTitle(new Uint8Array(await response.arrayBuffer()));
    } catch {
      return null;
    }
  };
  if (!useCache) {
    return load();
  }
  const pending = caseTitleCache.get(file) ?? load();
  caseTitleCache.set(file, pending);
  const title = await pending;
  if (!title) {
    caseTitleCache.delete(file);
  }
  return title;
}

export async function fetchHoloboxPackages(
  fetchImpl?: typeof fetch,
): Promise<HoloboxPackageListing[]> {
  if (!fetchImpl && import.meta.env.MODE === 'test') {
    return [];
  }
  try {
    const fetchFn = fetchImpl ?? fetch;
    const response = await fetchFn(withBaseUrl('/app-api/holobox-packages'), { cache: 'no-store' });
    if (!response.ok) {
      return [];
    }
    const payload = (await response.json()) as { packages?: unknown };
    if (!Array.isArray(payload.packages)) {
      return [];
    }
    const listings: HoloboxPackageListing[] = [];
    for (const item of payload.packages) {
      if (!item || typeof item !== 'object') {
        continue;
      }
      const file = (item as { file?: unknown }).file;
      if (typeof file !== 'string' || safeHoloboxPackageTitle(file) !== file) {
        continue;
      }
      const zip = holoboxZipRelative(file);
      if (!zip) {
        continue;
      }
      const title = await caseTitleForFile(file, fetchFn, !fetchImpl);
      if (!title) {
        continue;
      }
      listings.push({ file, title, zip });
    }
    return listings;
  } catch {
    return [];
  }
}

function caseText(files: HoloboxPackageFile[]): string | null {
  const names = files
    .map((file) => file.name.replaceAll('\\', '/'))
    .filter(
      (name) => name.startsWith('scenarios/') && name.endsWith('.json') && !name.includes('..'),
    );
  const preferred =
    names.find((name) => name === 'scenarios/verpleegkunde.json') ??
    names.find((name) => name.startsWith('scenarios/verpleegkunde-')) ??
    names[0];
  const file = files.find((entry) => entry.name.replaceAll('\\', '/') === preferred);
  if (!file) {
    return null;
  }
  const text = new TextDecoder().decode(file.data);
  return text.trim() ? text : null;
}

export async function openHoloboxPackageBytes(
  bytes: Uint8Array,
): Promise<{ ok: true; scenario: NursingScenario } | { ok: false; error: string }> {
  const opened = await decryptHoloboxPackage(bytes, HOLOBOX_PACKAGE_KEY);
  if (!opened.ok) {
    return { ok: false, error: 'De casus kon niet worden geopend.' };
  }
  const text = caseText(opened.files);
  if (!text) {
    return { ok: false, error: 'Het pakket bevat geen casus.' };
  }
  const parsed = parseVerpleegkundeEnvelope(text);
  if (!parsed.ok || nursingSaveIssues(parsed.scenario).length > 0) {
    return { ok: false, error: 'Het pakket bevat geen casus.' };
  }
  rememberPackageMedia(opened.files);
  return { ok: true, scenario: parsed.scenario };
}

export async function openHoloboxCase(
  file: string,
  fetchImpl?: typeof fetch,
): Promise<{ ok: true; scenario: NursingScenario } | { ok: false; error: string }> {
  if (safeHoloboxPackageTitle(file) !== file) {
    return { ok: false, error: 'De casus heeft geen naam voor een pakket.' };
  }
  try {
    const fetchFn = fetchImpl ?? fetch;
    const response = await fetchFn(
      withBaseUrl(`/app-api/holobox-package?name=${encodeURIComponent(file)}`),
      { cache: 'no-store' },
    );
    if (!response.ok) {
      return { ok: false, error: 'Het pakket kon niet worden geladen.' };
    }
    return openHoloboxPackageBytes(new Uint8Array(await response.arrayBuffer()));
  } catch {
    return { ok: false, error: 'Het pakket kon niet worden geladen.' };
  }
}
