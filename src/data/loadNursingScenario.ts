import { parseVerpleegkundeEnvelope } from '../editor/nursingEnvelope';
import { withBaseUrl } from '../media/baseUrl';
import { builtInNursingScenario } from '../nursing/scenario';
import type { NursingScenario } from '../nursing/types';
import { validateNursingScenario } from '../nursing/validateNursing';

export const NURSING_SCENARIO_JSON_PATH = '/resources/scenarios/verpleegkunde.json';

export function fallbackNursingScenario(): NursingScenario {
  return builtInNursingScenario;
}

export function resolveNursingScenarioFromText(text: string | null | undefined): NursingScenario {
  if (text == null || text.trim() === '') {
    return builtInNursingScenario;
  }
  try {
    const parsed = parseVerpleegkundeEnvelope(text);
    if (!parsed.ok) {
      return builtInNursingScenario;
    }
    if (validateNursingScenario(parsed.scenario).length > 0) {
      return builtInNursingScenario;
    }
    return parsed.scenario;
  } catch {
    return builtInNursingScenario;
  }
}

export async function resolveNursingScenario(
  fetchImpl?: typeof fetch,
): Promise<{ scenario: NursingScenario; source: 'json' | 'typescript' }> {
  const fallback = { scenario: builtInNursingScenario, source: 'typescript' as const };
  try {
    if (!fetchImpl && import.meta.env.MODE === 'test') {
      return fallback;
    }
    const fetchFn = fetchImpl ?? fetch;
    const response = await fetchFn(withBaseUrl(NURSING_SCENARIO_JSON_PATH), {
      cache: 'no-store',
    });
    if (!response.ok) {
      return fallback;
    }
    const scenario = resolveNursingScenarioFromText(await response.text());
    if (scenario === builtInNursingScenario) {
      return fallback;
    }
    return { scenario, source: 'json' };
  } catch {
    return fallback;
  }
}
