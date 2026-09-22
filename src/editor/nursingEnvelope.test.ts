import { describe, expect, it, vi } from 'vitest';
import { builtInNursingScenario } from '../nursing/scenario';
import { cloneNursingScenario } from './cloneNursing';
import {
  nursingEnvelopeJson,
  parseVerpleegkundeEnvelope,
  saveNursingEnvelopeToCopy,
  toVerpleegkundeEnvelope,
} from './nursingEnvelope';

describe('verpleegkunde editor envelope', () => {
  it('wraps the scenario without changing student source data', () => {
    const draft = cloneNursingScenario();
    draft.meta.title = 'Alleen in de editor';
    const envelope = toVerpleegkundeEnvelope(draft);
    expect(envelope.schemaVersion).toBe(1);
    expect(envelope.module).toBe('verpleegkunde');
    expect(envelope.steps[0]?.question).toBe(draft.steps[0]?.question);
    expect(JSON.parse(nursingEnvelopeJson(draft))).toEqual(envelope);
    expect(builtInNursingScenario.meta.title).not.toBe('Alleen in de editor');
  });

  it('parses a downloaded envelope into an independent copy', () => {
    const draft = cloneNursingScenario();
    draft.steps[0]!.question = 'Geladen uit JSON.';
    const parsed = parseVerpleegkundeEnvelope(nursingEnvelopeJson(draft));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.scenario.steps[0]?.question).toBe('Geladen uit JSON.');
    parsed.scenario.meta.title = 'Niet de bron';
    expect(builtInNursingScenario.meta.title).not.toBe('Niet de bron');
  });

  it('rejects invalid JSON, the wrong module, and an incomplete scenario', () => {
    expect(parseVerpleegkundeEnvelope('{')).toEqual({
      ok: false,
      error: 'Dit bestand is geen geldige JSON.',
    });
    expect(parseVerpleegkundeEnvelope('[]')).toEqual({
      ok: false,
      error: 'Het JSON-bestand heeft niet de verwachte vorm.',
    });
    expect(
      parseVerpleegkundeEnvelope(
        JSON.stringify({ ...toVerpleegkundeEnvelope(cloneNursingScenario()), schemaVersion: 2 }),
      ),
    ).toEqual({ ok: false, error: 'schemaVersion moet 1 zijn.' });
    expect(
      parseVerpleegkundeEnvelope(
        JSON.stringify({ schemaVersion: 1, module: 'logopedie', scenario: {} }),
      ),
    ).toEqual({ ok: false, error: 'module moet verpleegkunde zijn.' });
  });

  it('posts the envelope to this copy and reports a missing editor API', async () => {
    const draft = cloneNursingScenario();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, file: 'resources/scenarios/verpleegkunde.json' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(saveNursingEnvelopeToCopy(draft)).resolves.toEqual({ ok: true });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/editor-api/save-verpleegkunde');
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      module: string;
      steps: Array<{ question: string }>;
    };
    expect(body.module).toBe('verpleegkunde');
    expect(body.steps[0]?.question).toBe(draft.steps[0]?.question);

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(saveNursingEnvelopeToCopy(draft)).resolves.toEqual({
      ok: false,
      error: 'Opslaan is niet beschikbaar. Start de bewerker via Editor.exe of npm run dev.',
    });
  });
});
