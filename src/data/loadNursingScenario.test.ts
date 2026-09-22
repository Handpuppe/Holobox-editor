import { describe, expect, it } from 'vitest';
import { cloneNursingScenario } from '../editor/cloneNursing';
import { nursingEnvelopeJson } from '../editor/nursingEnvelope';
import { builtInNursingScenario } from '../nursing/scenario';
import { resolveNursingScenario, resolveNursingScenarioFromText } from './loadNursingScenario';

describe('verpleegkunde JSON overlay', () => {
  it('uses a valid envelope and falls back to TypeScript otherwise', () => {
    const draft = cloneNursingScenario();
    draft.steps[0]!.question = 'Vraag uit opgeslagen JSON.';
    const loaded = resolveNursingScenarioFromText(nursingEnvelopeJson(draft));
    expect(loaded.steps[0]?.question).toBe('Vraag uit opgeslagen JSON.');
    expect(builtInNursingScenario.steps[0]?.question).not.toBe('Vraag uit opgeslagen JSON.');

    expect(resolveNursingScenarioFromText(null)).toBe(builtInNursingScenario);
    expect(resolveNursingScenarioFromText('{')).toBe(builtInNursingScenario);
    expect(
      resolveNursingScenarioFromText(
        JSON.stringify({ schemaVersion: 1, module: 'logopedie', scenario: draft }),
      ),
    ).toBe(builtInNursingScenario);
  });

  it('never throws when fetch fails or returns invalid JSON', async () => {
    const missing = await resolveNursingScenario(
      async () => new Response('missing', { status: 404 }),
    );
    expect(missing).toEqual({ scenario: builtInNursingScenario, source: 'typescript' });

    const invalid = await resolveNursingScenario(
      async () =>
        new Response('{niet-json', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    expect(invalid).toEqual({ scenario: builtInNursingScenario, source: 'typescript' });

    const exploding = await resolveNursingScenario(async () => {
      throw new Error('network');
    });
    expect(exploding).toEqual({ scenario: builtInNursingScenario, source: 'typescript' });
  });
});
