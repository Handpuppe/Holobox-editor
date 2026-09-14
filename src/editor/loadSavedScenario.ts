import { LOGOPEDIE_SCENARIO_JSON_PATH } from '../data/loadLogopedieScenario';
import { withBaseUrl } from '../media/baseUrl';
import type { Scenario } from '../domain/types';
import { cloneScenario } from './cloneScenario';
import { LOGOPEDIE_ENVELOPE_FILENAME, parseLogopedieEnvelope } from './envelope';

export type EditorStartupSource = 'json' | 'seed';

export interface EditorStartupLoad {
  scenario: Scenario;
  source: EditorStartupSource;
  label: string;
  notice: string | null;
}

export function editorSourceLabel(source: EditorStartupSource, fileName?: string): string {
  if (source === 'json') {
    return `Geladen: ${fileName?.trim() || LOGOPEDIE_ENVELOPE_FILENAME}`;
  }
  return 'Geladen: startkopie';
}

export async function loadEditorStartupScenario(
  fetchImpl?: typeof fetch,
): Promise<EditorStartupLoad> {
  const seed = (): EditorStartupLoad => ({
    scenario: cloneScenario(),
    source: 'seed',
    label: editorSourceLabel('seed'),
    notice: 'Geen opgeslagen logopedie.json gevonden.',
  });
  try {
    const fetchFn = fetchImpl ?? fetch;
    const response = await fetchFn(withBaseUrl(LOGOPEDIE_SCENARIO_JSON_PATH), {
      cache: 'no-store',
    });
    if (!response.ok) {
      return seed();
    }
    const parsed = parseLogopedieEnvelope(await response.text());
    if (!parsed.ok) {
      return {
        scenario: cloneScenario(),
        source: 'seed',
        label: editorSourceLabel('seed'),
        notice: `Opgeslagen logopedie.json is ongeldig: ${parsed.error}`,
      };
    }
    return {
      scenario: parsed.scenario,
      source: 'json',
      label: editorSourceLabel('json'),
      notice: null,
    };
  } catch {
    return seed();
  }
}
