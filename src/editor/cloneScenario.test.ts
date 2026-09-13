import { describe, expect, it } from 'vitest';
import { aphasiaIntakeScenario } from '../data/aphasiaIntakeScenario';
import { cloneScenario } from './cloneScenario';

describe('cloneScenario', () => {
  it('returns an independent copy of the shipped Logopedie scenario', () => {
    const original = aphasiaIntakeScenario.nodes[0]?.prompt.text;
    const clone = cloneScenario();
    expect(clone).toEqual(aphasiaIntakeScenario);
    expect(clone).not.toBe(aphasiaIntakeScenario);
    expect(clone.nodes).not.toBe(aphasiaIntakeScenario.nodes);
    if (clone.nodes[0]) {
      clone.nodes[0].prompt.text = 'Gewijzigd in de editor';
    }
    expect(aphasiaIntakeScenario.nodes[0]?.prompt.text).toBe(original);
  });
});
