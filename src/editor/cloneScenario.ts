import { aphasiaIntakeScenario } from '../data/aphasiaIntakeScenario';
import type { Scenario } from '../domain/types';

export function cloneScenario(source: Scenario = aphasiaIntakeScenario): Scenario {
  return structuredClone(source);
}
