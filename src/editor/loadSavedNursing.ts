import { NURSING_SCENARIO_JSON_PATH } from '../data/loadNursingScenario';
import { withBaseUrl } from '../media/baseUrl';
import { NURSING_SCENARIO_ID } from '../media/scenarioMedia';
import type { NursingScenario } from '../nursing/types';
import { EDITOR_CASES_PATH } from './editorCases';
import { emptyNursingScenario } from './emptyScenario';
import { parseVerpleegkundeEnvelope, VERPLEEGKUNDE_ENVELOPE_FILENAME } from './nursingEnvelope';

const EXAMPLE_NURSING_TITLES = new Set([
  'abcde en sbar bij acute benauwdheid',
  'sbar bij acute benauwdheid',
]);

export function isBundledNursingExample(scenario: NursingScenario): boolean {
  const id = scenario.meta.id.trim().toLowerCase();
  const title = scenario.meta.title.trim().toLowerCase().replace(/\s+/g, ' ');
  return id === NURSING_SCENARIO_ID || EXAMPLE_NURSING_TITLES.has(title);
}

export function isGesprekCaseFile(fileName: string): boolean {
  const name = fileName.replaceAll('\\', '/').split('/').pop() ?? '';
  return (
    name === VERPLEEGKUNDE_ENVELOPE_FILENAME ||
    (name.startsWith('verpleegkunde-') && name.endsWith('.json') && !name.endsWith('.bak'))
  );
}

export type NursingEditorStartupSource = 'json' | 'seed';

export interface NursingEditorStartupLoad {
  scenario: NursingScenario;
  source: NursingEditorStartupSource;
  label: string;
  notice: string | null;
  fileName: string | null;
}

/** Tekst bovenaan de editor: de casusnaam, of een lege casus. */
export function loadedCaseLabel(title: string | null | undefined): string {
  const name = (title ?? '').replace(/\s+/g, ' ').trim();
  return name.length > 0 ? `Geladen: ${name}` : 'Geladen: nieuwe casus';
}

function seedLoad(notice: string | null): NursingEditorStartupLoad {
  return {
    scenario: emptyNursingScenario(),
    source: 'seed',
    label: loadedCaseLabel(''),
    notice,
    fileName: null,
  };
}

async function readGesprekCaseFile(
  fetchFn: typeof fetch,
  fileName: string,
): Promise<NursingEditorStartupLoad | null> {
  const response = await fetchFn(
    withBaseUrl(`/resources/scenarios/${encodeURIComponent(fileName)}`),
    { cache: 'no-store' },
  );
  if (!response.ok) {
    return null;
  }
  const parsed = parseVerpleegkundeEnvelope(await response.text());
  if (!parsed.ok || isBundledNursingExample(parsed.scenario)) {
    return null;
  }
  return {
    scenario: parsed.scenario,
    source: 'json',
    label: loadedCaseLabel(parsed.scenario.meta.title),
    notice: null,
    fileName,
  };
}

async function newestGesprekCaseFile(fetchFn: typeof fetch): Promise<string | null> {
  try {
    const response = await fetchFn(withBaseUrl(`${EDITOR_CASES_PATH}?module=verpleegkunde`), {
      cache: 'no-store',
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as {
      cases?: Array<{ file?: unknown; savedAt?: unknown }>;
    };
    const cases = Array.isArray(payload.cases) ? payload.cases : [];
    const named = cases.filter(
      (item): item is { file: string; savedAt?: unknown } =>
        typeof item.file === 'string' && isGesprekCaseFile(item.file),
    );
    if (named.length === 0) {
      return null;
    }
    named.sort((left, right) =>
      String(right.savedAt ?? '').localeCompare(String(left.savedAt ?? '')),
    );
    return named[0]?.file ?? null;
  } catch {
    return null;
  }
}

async function loadVerpleegkundeOverlay(fetchFn: typeof fetch): Promise<NursingEditorStartupLoad> {
  try {
    const response = await fetchFn(withBaseUrl(NURSING_SCENARIO_JSON_PATH), {
      cache: 'no-store',
    });
    if (!response.ok) {
      return seedLoad('Geen opgeslagen verpleegkunde.json gevonden.');
    }
    const parsed = parseVerpleegkundeEnvelope(await response.text());
    if (!parsed.ok) {
      return seedLoad(`Opgeslagen verpleegkunde.json is ongeldig: ${parsed.error}`);
    }
    if (isBundledNursingExample(parsed.scenario)) {
      return seedLoad(null);
    }
    return {
      scenario: parsed.scenario,
      source: 'json',
      label: loadedCaseLabel(parsed.scenario.meta.title),
      notice: null,
      fileName: VERPLEEGKUNDE_ENVELOPE_FILENAME,
    };
  } catch {
    return seedLoad('Geen opgeslagen verpleegkunde.json gevonden.');
  }
}

export async function loadEditorStartupNursing(
  fetchImpl?: typeof fetch,
): Promise<NursingEditorStartupLoad> {
  const fetchFn = fetchImpl ?? fetch;
  const newest = await newestGesprekCaseFile(fetchFn);
  if (newest && newest !== VERPLEEGKUNDE_ENVELOPE_FILENAME) {
    try {
      const loaded = await readGesprekCaseFile(fetchFn, newest);
      if (loaded) {
        return loaded;
      }
    } catch {
      // De nieuwste casus is niet leesbaar. Daarna geldt de gesprekscasus.
    }
  }
  return loadVerpleegkundeOverlay(fetchFn);
}

export async function loadNursingCaseByName(
  fileName: string,
  fetchImpl?: typeof fetch,
): Promise<NursingEditorStartupLoad> {
  const fetchFn = fetchImpl ?? fetch;
  const name = isGesprekCaseFile(fileName) ? fileName : VERPLEEGKUNDE_ENVELOPE_FILENAME;
  if (name !== VERPLEEGKUNDE_ENVELOPE_FILENAME) {
    try {
      const loaded = await readGesprekCaseFile(fetchFn, name);
      if (loaded) {
        return loaded;
      }
    } catch {
      // Val terug op de gesprekscasus in verpleegkunde.json.
    }
  }
  return loadVerpleegkundeOverlay(fetchFn);
}
