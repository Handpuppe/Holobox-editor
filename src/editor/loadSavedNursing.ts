import { NURSING_SCENARIO_JSON_PATH } from '../data/loadNursingScenario';
import { withBaseUrl } from '../media/baseUrl';
import type { NursingScenario } from '../nursing/types';
import { cloneNursingScenario } from './cloneNursing';
import { parseVerpleegkundeEnvelope, VERPLEEGKUNDE_ENVELOPE_FILENAME } from './nursingEnvelope';

export type NursingEditorStartupSource = 'json' | 'seed';

export interface NursingEditorStartupLoad {
  scenario: NursingScenario;
  source: NursingEditorStartupSource;
  label: string;
  notice: string | null;
}

export function nursingEditorSourceLabel(
  source: NursingEditorStartupSource,
  fileName?: string,
): string {
  if (source === 'json') {
    return `Geladen: ${fileName?.trim() || VERPLEEGKUNDE_ENVELOPE_FILENAME}`;
  }
  return 'Geladen: startkopie';
}

export async function loadEditorStartupNursing(
  fetchImpl?: typeof fetch,
): Promise<NursingEditorStartupLoad> {
  const seed = (): NursingEditorStartupLoad => ({
    scenario: cloneNursingScenario(),
    source: 'seed',
    label: nursingEditorSourceLabel('seed'),
    notice: 'Geen opgeslagen verpleegkunde.json gevonden.',
  });
  try {
    const fetchFn = fetchImpl ?? fetch;
    const response = await fetchFn(withBaseUrl(NURSING_SCENARIO_JSON_PATH), {
      cache: 'no-store',
    });
    if (!response.ok) {
      return seed();
    }
    const parsed = parseVerpleegkundeEnvelope(await response.text());
    if (!parsed.ok) {
      return {
        scenario: cloneNursingScenario(),
        source: 'seed',
        label: nursingEditorSourceLabel('seed'),
        notice: `Opgeslagen verpleegkunde.json is ongeldig: ${parsed.error}`,
      };
    }
    return {
      scenario: parsed.scenario,
      source: 'json',
      label: nursingEditorSourceLabel('json'),
      notice: null,
    };
  } catch {
    return seed();
  }
}
