import { parseLogopedieEnvelope } from '../editor/envelope';
import { validateScenario } from '../domain/scenarioValidation';
import { withBaseUrl } from '../media/baseUrl';
import type { Scenario } from '../domain/types';
import { aphasiaIntakeScenario } from './aphasiaIntakeScenario';

export const LOGOPEDIE_SCENARIO_JSON_PATH = '/resources/scenarios/logopedie.json';

export function fallbackLogopedieScenario(): Scenario {
  return aphasiaIntakeScenario;
}

export function resolveLogopedieScenarioFromText(text: string | null | undefined): Scenario {
  if (text == null || text.trim() === '') {
    return aphasiaIntakeScenario;
  }
  try {
    const parsed = parseLogopedieEnvelope(text);
    if (!parsed.ok) {
      return aphasiaIntakeScenario;
    }
    if (validateScenario(parsed.scenario).length > 0) {
      return aphasiaIntakeScenario;
    }
    return parsed.scenario;
  } catch {
    return aphasiaIntakeScenario;
  }
}

export async function resolveLogopedieScenario(
  fetchImpl?: typeof fetch,
): Promise<{ scenario: Scenario; source: 'json' | 'typescript' }> {
  const fallback = { scenario: aphasiaIntakeScenario, source: 'typescript' as const };
  try {
    if (!fetchImpl && import.meta.env.MODE === 'test') {
      return fallback;
    }
    const fetchFn = fetchImpl ?? fetch;
    const response = await fetchFn(withBaseUrl(LOGOPEDIE_SCENARIO_JSON_PATH), {
      cache: 'no-store',
    });
    if (!response.ok) {
      return fallback;
    }
    const scenario = resolveLogopedieScenarioFromText(await response.text());
    if (scenario === aphasiaIntakeScenario) {
      return fallback;
    }
    return { scenario, source: 'json' };
  } catch {
    return fallback;
  }
}
