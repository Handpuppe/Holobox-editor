import { describe, expect, it } from 'vitest';
import { builtInNursingScenario } from '../nursing/scenario';
import { cloneNursingScenario } from './cloneNursing';
import { nursingEnvelopeJson } from './nursingEnvelope';
import { emptyNursingScenario } from './emptyScenario';
import {
  isBundledNursingExample,
  loadEditorStartupNursing,
  nursingEditorSourceLabel,
} from './loadSavedNursing';

describe('nursing editor startup JSON', () => {
  it('loads a self-made scenario and skips the ABCDE/SBAR example', async () => {
    const example = cloneNursingScenario();
    example.steps[0]!.question = 'Extra zin uit verpleegkunde.json.';
    const skipped = await loadEditorStartupNursing(
      async () =>
        new Response(nursingEnvelopeJson(example), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    expect(isBundledNursingExample(example)).toBe(true);
    expect(skipped.source).toBe('seed');
    expect(skipped.label).toBe('Geladen: startkopie');
    expect(skipped.notice).toBeNull();
    expect(skipped.scenario.meta.id).toBe('editor-leeg');
    expect(skipped.scenario.meta.title).toBe('');
    expect(skipped.scenario.steps[0]?.question).toBe('');
    expect(builtInNursingScenario.steps[0]?.question).not.toBe('Extra zin uit verpleegkunde.json.');

    const renamed = cloneNursingScenario();
    renamed.meta = { ...renamed.meta, id: 'eigen-id', title: 'SBAR bij acute benauwdheid' };
    const renamedLoad = await loadEditorStartupNursing(
      async () => new Response(nursingEnvelopeJson(renamed), { status: 200 }),
    );
    expect(renamedLoad.source).toBe('seed');
    expect(renamedLoad.scenario.steps[0]?.question).toBe('');

    const own = emptyNursingScenario();
    own.meta = { ...own.meta, id: 'eigen-casus', title: 'Opname op de afdeling' };
    own.steps[0]!.question = 'Wat zie je?';
    const loaded = await loadEditorStartupNursing(
      async () =>
        new Response(nursingEnvelopeJson(own), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    expect(loaded.source).toBe('json');
    expect(loaded.label).toBe('Geladen: verpleegkunde.json');
    expect(loaded.notice).toBeNull();
    expect(loaded.scenario.steps[0]?.question).toBe('Wat zie je?');

    const missing = await loadEditorStartupNursing(
      async () => new Response('missing', { status: 404 }),
    );
    expect(missing.source).toBe('seed');
    expect(missing.label).toBe('Geladen: startkopie');
    expect(missing.notice).toBe('Geen opgeslagen verpleegkunde.json gevonden.');
    expect(missing.scenario.steps).toHaveLength(1);
    expect(missing.scenario.steps[0]?.question).toBe('');
    expect(missing.scenario.steps[0]?.question).not.toContain('luchtweg');

    const invalid = await loadEditorStartupNursing(
      async () =>
        new Response('{niet-json', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    expect(invalid.source).toBe('seed');
    expect(invalid.notice).toContain('ongeldig');
    expect(invalid.scenario.steps).toHaveLength(1);
    expect(invalid.scenario.steps[0]?.question).toBe('');
  });

  it('labels the built-in copy and a saved file', () => {
    expect(nursingEditorSourceLabel('seed')).toBe('Geladen: startkopie');
    expect(nursingEditorSourceLabel('json')).toBe('Geladen: verpleegkunde.json');
    expect(nursingEditorSourceLabel('json', 'mijn-scenario.json')).toBe(
      'Geladen: mijn-scenario.json',
    );
  });
});
