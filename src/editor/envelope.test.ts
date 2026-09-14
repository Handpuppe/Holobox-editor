import { describe, expect, it, vi } from 'vitest';
import { aphasiaIntakeScenario } from '../data/aphasiaIntakeScenario';
import { cloneScenario } from './cloneScenario';
import {
  envelopeJson,
  parseLogopedieEnvelope,
  saveEnvelopeToCopy,
  toLogopedieEnvelope,
} from './envelope';

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

  it('parses a downloaded envelope into an independent scenario copy', () => {
    const draft = cloneScenario();
    draft.nodes[0]!.prompt.text = 'Geladen uit JSON.';
    const parsed = parseLogopedieEnvelope(envelopeJson(draft));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.scenario.nodes[0]?.prompt.text).toBe('Geladen uit JSON.');
    expect(parsed.scenario.nodes[0]?.prompt.text).not.toBe(
      aphasiaIntakeScenario.nodes[0]?.prompt.text,
    );
    parsed.scenario.title = 'Niet de bron';
    expect(aphasiaIntakeScenario.title).not.toBe('Niet de bron');
  });

  it('rejects invalid JSON, the wrong module, and an incomplete scenario', () => {
    expect(parseLogopedieEnvelope('{')).toEqual({
      ok: false,
      error: 'Dit bestand is geen geldige JSON.',
    });
    expect(parseLogopedieEnvelope('[]')).toEqual({
      ok: false,
      error: 'Het JSON-bestand heeft niet de verwachte vorm.',
    });
    expect(
      parseLogopedieEnvelope(
        JSON.stringify({ schemaVersion: 2, module: 'logopedie', scenario: cloneScenario() }),
      ),
    ).toEqual({ ok: false, error: 'schemaVersion moet 1 zijn.' });
    expect(
      parseLogopedieEnvelope(
        JSON.stringify({ schemaVersion: 1, module: 'verpleegkunde', scenario: cloneScenario() }),
      ),
    ).toEqual({ ok: false, error: 'module moet logopedie zijn.' });
    expect(
      parseLogopedieEnvelope(JSON.stringify({ schemaVersion: 1, module: 'logopedie' })),
    ).toEqual({ ok: false, error: 'scenario ontbreekt of is ongeldig.' });
    expect(
      parseLogopedieEnvelope(
        JSON.stringify({ schemaVersion: 1, module: 'logopedie', scenario: { id: 'x' } }),
      ),
    ).toEqual({ ok: false, error: 'scenario mist identificatie, titel of startvraag.' });
  });

  it('posts the envelope to this copy and reports a missing editor API', async () => {
    const draft = cloneScenario();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, file: 'resources/scenarios/logopedie.json' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(saveEnvelopeToCopy(draft)).resolves.toEqual({ ok: true });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/editor-api/save-logopedie');
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      module: string;
      scenario: { id: string };
    };
    expect(body.module).toBe('logopedie');
    expect(body.scenario.id).toBe(draft.id);

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(saveEnvelopeToCopy(draft)).resolves.toEqual({
      ok: false,
      error: 'Opslaan is niet beschikbaar. Start de bewerker via Editor.exe of npm run dev.',
    });
  });
});
