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
  title: string;
  zip: string;
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
      const title = (item as { title?: unknown }).title;
      if (typeof title !== 'string' || safeHoloboxPackageTitle(title) !== title) {
        continue;
      }
      const zip = holoboxZipRelative(title);
      if (!zip) {
        continue;
      }
      listings.push({ title, zip });
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
  title: string,
  fetchImpl?: typeof fetch,
): Promise<{ ok: true; scenario: NursingScenario } | { ok: false; error: string }> {
  if (safeHoloboxPackageTitle(title) !== title) {
    return { ok: false, error: 'De casus heeft geen naam voor een pakket.' };
  }
  try {
    const fetchFn = fetchImpl ?? fetch;
    const response = await fetchFn(
      withBaseUrl(`/app-api/holobox-package?name=${encodeURIComponent(title)}`),
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
