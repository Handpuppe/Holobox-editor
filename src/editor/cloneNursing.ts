import { builtInNursingScenario } from '../nursing/scenario';
import type { NursingScenario } from '../nursing/types';

export function cloneNursingScenario(
  source: NursingScenario = builtInNursingScenario,
): NursingScenario {
  return structuredClone(source);
}
