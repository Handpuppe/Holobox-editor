import { describe, expect, it } from 'vitest';
import { aphasiaIntakeScenario } from '../data/aphasiaIntakeScenario';
import { assertValidScenario, validateScenario } from './scenarioValidation';
import type { Scenario } from './types';

describe('scenario validation', () => {
  it('accepts the shipped aphasia scenario', () => {
    expect(validateScenario(aphasiaIntakeScenario)).toEqual([]);
    expect(() => assertValidScenario(aphasiaIntakeScenario)).not.toThrow();
  });

  it('rejects a scenario with too few nodes', () => {
    const broken = {
      ...aphasiaIntakeScenario,
      nodes: aphasiaIntakeScenario.nodes.slice(0, 2),
    } as Scenario;
    const issues = validateScenario(broken);
    expect(issues.some((issue) => issue.includes('acht'))).toBe(true);
  });
});
