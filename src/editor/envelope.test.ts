import { describe, expect, it } from 'vitest';
import { aphasiaIntakeScenario } from '../data/aphasiaIntakeScenario';
import { cloneScenario } from './cloneScenario';
import { envelopeJson, toLogopedieEnvelope } from './envelope';

describe('logopedie editor envelope', () => {
  it('wraps the scenario without changing student source data', () => {
    const draft = cloneScenario();
    draft.title = 'Alleen in de editor';
    const envelope = toLogopedieEnvelope(draft);
    expect(envelope).toEqual({
      schemaVersion: 1,
      module: 'logopedie',
      scenario: draft,
    });
    expect(JSON.parse(envelopeJson(draft))).toEqual(envelope);
    expect(aphasiaIntakeScenario.title).not.toBe('Alleen in de editor');
  });
});
