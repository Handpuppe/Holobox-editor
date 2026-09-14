import { describe, expect, it } from 'vitest';
import { aphasiaIntakeScenario } from './aphasiaIntakeScenario';
import { cloneScenario } from '../editor/cloneScenario';
import { envelopeJson } from '../editor/envelope';
import {
  resolveLogopedieScenario,
  resolveLogopedieScenarioFromText,
} from './loadLogopedieScenario';

describe('logopedie JSON overlay', () => {
  it('uses a valid envelope and falls back to TypeScript otherwise', () => {
    const draft = cloneScenario();
    draft.nodes[0]!.prompt.text = 'Vraag uit opgeslagen JSON.';
    const loaded = resolveLogopedieScenarioFromText(envelopeJson(draft));
    expect(loaded.nodes[0]?.prompt.text).toBe('Vraag uit opgeslagen JSON.');
    expect(aphasiaIntakeScenario.nodes[0]?.prompt.text).not.toBe('Vraag uit opgeslagen JSON.');

    expect(resolveLogopedieScenarioFromText(null)).toBe(aphasiaIntakeScenario);
    expect(resolveLogopedieScenarioFromText('{')).toBe(aphasiaIntakeScenario);
    expect(
      resolveLogopedieScenarioFromText(
        JSON.stringify({ schemaVersion: 1, module: 'verpleegkunde', scenario: draft }),
      ),
    ).toBe(aphasiaIntakeScenario);

    const broken = cloneScenario();
    broken.nodes = broken.nodes.slice(0, 2);
    expect(resolveLogopedieScenarioFromText(envelopeJson(broken))).toBe(aphasiaIntakeScenario);
  });

  it('never throws when fetch fails or returns invalid JSON', async () => {
    const missing = await resolveLogopedieScenario(
      async () => new Response('missing', { status: 404 }),
    );
    expect(missing).toEqual({ scenario: aphasiaIntakeScenario, source: 'typescript' });

    const invalid = await resolveLogopedieScenario(
      async () =>
        new Response('{niet-json', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    expect(invalid).toEqual({ scenario: aphasiaIntakeScenario, source: 'typescript' });

    const exploding = await resolveLogopedieScenario(async () => {
      throw new Error('network');
    });
    expect(exploding).toEqual({ scenario: aphasiaIntakeScenario, source: 'typescript' });
  });
});
