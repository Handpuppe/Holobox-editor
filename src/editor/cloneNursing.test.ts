import { describe, expect, it } from 'vitest';
import { builtInNursingScenario } from '../nursing/scenario';
import { cloneNursingScenario } from './cloneNursing';

describe('cloneNursingScenario', () => {
  it('returns an independent copy of the shipped Verpleegkunde scenario', () => {
    const original = builtInNursingScenario.steps[0]?.question;
    const clone = cloneNursingScenario();
    expect(clone.steps[0]?.question).toBe(original);
    expect(clone.steps).not.toBe(builtInNursingScenario.steps);
    if (clone.steps[0]) {
      clone.steps[0].question = 'Gewijzigd in de editor';
    }
    expect(builtInNursingScenario.steps[0]?.question).toBe(original);
  });
});
