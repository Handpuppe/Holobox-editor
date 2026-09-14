import { describe, expect, it } from 'vitest';
import { aphasiaIntakeScenario } from '../data/aphasiaIntakeScenario';
import { cloneScenario } from './cloneScenario';
import { envelopeJson } from './envelope';
import { editorSourceLabel, loadEditorStartupScenario } from './loadSavedScenario';

describe('editor startup JSON', () => {
  it('loads a valid saved envelope and falls back with a notice otherwise', async () => {
    const draft = cloneScenario();
    draft.nodes[0]!.prompt.text = 'Extra zin uit logopedie.json.';
    const loaded = await loadEditorStartupScenario(
      async () =>
        new Response(envelopeJson(draft), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    expect(loaded.source).toBe('json');
    expect(loaded.label).toBe('Geladen: logopedie.json');
    expect(loaded.notice).toBeNull();
    expect(loaded.scenario.nodes[0]?.prompt.text).toBe('Extra zin uit logopedie.json.');
    expect(aphasiaIntakeScenario.nodes[0]?.prompt.text).not.toBe('Extra zin uit logopedie.json.');

    const missing = await loadEditorStartupScenario(
      async () => new Response('missing', { status: 404 }),
    );
    expect(missing.source).toBe('seed');
    expect(missing.label).toBe('Geladen: startkopie');
    expect(missing.notice).toBe('Geen opgeslagen logopedie.json gevonden.');
    expect(missing.scenario.nodes[0]?.prompt.text).toBe(
      aphasiaIntakeScenario.nodes[0]?.prompt.text,
    );

    const invalid = await loadEditorStartupScenario(
      async () =>
        new Response('{niet-json', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    expect(invalid.source).toBe('seed');
    expect(invalid.label).toBe('Geladen: startkopie');
    expect(invalid.notice).toContain('ongeldig');
    expect(invalid.scenario).toEqual(cloneScenario());

    await expect(
      loadEditorStartupScenario(async () => {
        throw new Error('network');
      }),
    ).resolves.toMatchObject({ source: 'seed', label: 'Geladen: startkopie' });
  });

  it('labels the built-in copy and a saved file', () => {
    expect(editorSourceLabel('seed')).toBe('Geladen: startkopie');
    expect(editorSourceLabel('json')).toBe('Geladen: logopedie.json');
    expect(editorSourceLabel('json', 'mijn-scenario.json')).toBe('Geladen: mijn-scenario.json');
  });
});
