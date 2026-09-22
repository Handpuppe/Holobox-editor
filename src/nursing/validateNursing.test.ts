import { describe, expect, it } from 'vitest';
import { cloneNursingScenario } from '../editor/cloneNursing';
import { builtInNursingScenario } from './scenario';
import { validateNursingScenario } from './validateNursing';

describe('validateNursingScenario', () => {
  it('accepts the built-in TypeScript scenario', () => {
    expect(validateNursingScenario(builtInNursingScenario)).toEqual([]);
  });

  it('rejects a step without three qualities or an unknown next step', () => {
    const draft = cloneNursingScenario();
    draft.steps[0]!.options[1]!.quality = 'high';
    expect(validateNursingScenario(draft).some((issue) => issue.includes('partial'))).toBe(true);

    const broken = cloneNursingScenario();
    broken.steps[0]!.options[0]!.nextStepId = 'niet-bestaand';
    expect(validateNursingScenario(broken).some((issue) => issue.includes('niet-bestaand'))).toBe(
      true,
    );
  });
});
