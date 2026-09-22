import { describe, expect, it } from 'vitest';
import { builtInNursingScenario } from '../nursing/scenario';
import { cloneNursingScenario } from './cloneNursing';
import { nursingEnvelopeJson } from './nursingEnvelope';
import { loadEditorStartupNursing, nursingEditorSourceLabel } from './loadSavedNursing';

describe('nursing editor startup JSON', () => {
  it('loads a valid saved envelope and falls back with a notice otherwise', async () => {
    const draft = cloneNursingScenario();
    draft.steps[0]!.question = 'Extra zin uit verpleegkunde.json.';
    const loaded = await loadEditorStartupNursing(
      async () =>
        new Response(nursingEnvelopeJson(draft), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    expect(loaded.source).toBe('json');
    expect(loaded.label).toBe('Geladen: verpleegkunde.json');
    expect(loaded.notice).toBeNull();
    expect(loaded.scenario.steps[0]?.question).toBe('Extra zin uit verpleegkunde.json.');
    expect(builtInNursingScenario.steps[0]?.question).not.toBe('Extra zin uit verpleegkunde.json.');

    const missing = await loadEditorStartupNursing(
      async () => new Response('missing', { status: 404 }),
    );
    expect(missing.source).toBe('seed');
    expect(missing.label).toBe('Geladen: startkopie');
    expect(missing.notice).toBe('Geen opgeslagen verpleegkunde.json gevonden.');

    const invalid = await loadEditorStartupNursing(
      async () =>
        new Response('{niet-json', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    expect(invalid.source).toBe('seed');
    expect(invalid.notice).toContain('ongeldig');
  });

  it('labels the built-in copy and a saved file', () => {
    expect(nursingEditorSourceLabel('seed')).toBe('Geladen: startkopie');
    expect(nursingEditorSourceLabel('json')).toBe('Geladen: verpleegkunde.json');
    expect(nursingEditorSourceLabel('json', 'mijn-scenario.json')).toBe(
      'Geladen: mijn-scenario.json',
    );
  });
});
