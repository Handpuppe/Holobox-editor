import { describe, expect, it } from 'vitest';
import { builtInNursingScenario } from '../nursing/scenario';
import { cloneNursingScenario } from './cloneNursing';
import { nursingEnvelopeJson } from './nursingEnvelope';
import { emptyNursingScenario } from './emptyScenario';
import {
  isBundledNursingExample,
  loadEditorStartupNursing,
  loadNursingCaseByName,
  loadedCaseLabel,
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
    expect(skipped.label).toBe('Geladen: nieuwe casus');
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
    expect(loaded.label).toBe('Geladen: Opname op de afdeling');
    expect(loaded.notice).toBeNull();
    expect(loaded.scenario.steps[0]?.question).toBe('Wat zie je?');

    const missing = await loadEditorStartupNursing(
      async () => new Response('missing', { status: 404 }),
    );
    expect(missing.source).toBe('seed');
    expect(missing.label).toBe('Geladen: nieuwe casus');
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

  it('opens the newest gesprek case, otherwise Slechtnieuwsgesprek oefenen', async () => {
    const older = emptyNursingScenario();
    older.meta = { ...older.meta, id: 'oud', title: 'Oude casus' };
    older.steps[0]!.question = 'Oud';
    const newer = emptyNursingScenario();
    newer.meta = { ...newer.meta, id: 'nieuw', title: 'Nieuwe casus' };
    newer.steps[0]!.question = 'Nieuw';
    const slecht = emptyNursingScenario();
    slecht.meta = { ...slecht.meta, id: 'slecht', title: 'Slechtnieuwsgesprek oefenen' };
    slecht.steps[0]!.question = 'Slechtnieuws';

    const loaded = await loadEditorStartupNursing(async (url) => {
      const target = String(url);
      if (target.includes('/editor-api/cases')) {
        return new Response(
          JSON.stringify({
            ok: true,
            cases: [
              {
                file: 'verpleegkunde-oud.json',
                title: 'Oude casus',
                savedAt: '2026-10-01T00:00:00.000Z',
              },
              {
                file: 'logopedie.json',
                title: 'Logopedie',
                savedAt: '2026-10-07T00:00:00.000Z',
              },
              {
                file: 'verpleegkunde-nieuw.json',
                title: 'Nieuwe casus',
                savedAt: '2026-10-06T00:00:00.000Z',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (target.includes('verpleegkunde-nieuw.json')) {
        return new Response(nursingEnvelopeJson(newer), { status: 200 });
      }
      if (target.includes('verpleegkunde-oud.json')) {
        return new Response(nursingEnvelopeJson(older), { status: 200 });
      }
      if (target.includes('verpleegkunde.json')) {
        return new Response(nursingEnvelopeJson(slecht), { status: 200 });
      }
      return new Response('missing', { status: 404 });
    });
    expect(loaded.source).toBe('json');
    expect(loaded.fileName).toBe('verpleegkunde-nieuw.json');
    expect(loaded.scenario.steps[0]?.question).toBe('Nieuw');
    expect(loaded.label).toBe('Geladen: Nieuwe casus');

    const fallback = await loadEditorStartupNursing(async (url) => {
      const target = String(url);
      if (target.includes('/editor-api/cases')) {
        return new Response(JSON.stringify({ ok: true, cases: [] }), { status: 200 });
      }
      if (target.includes('verpleegkunde.json')) {
        return new Response(nursingEnvelopeJson(slecht), { status: 200 });
      }
      return new Response('missing', { status: 404 });
    });
    expect(fallback.fileName).toBe('verpleegkunde.json');
    expect(fallback.scenario.meta.title).toBe('Slechtnieuwsgesprek oefenen');
    expect(fallback.scenario.steps[0]?.question).toBe('Slechtnieuws');

    const restored = await loadNursingCaseByName('verpleegkunde-nieuw.json', async (url) => {
      const target = String(url);
      if (target.includes('verpleegkunde-nieuw.json')) {
        return new Response('missing', { status: 404 });
      }
      if (target.includes('verpleegkunde.json')) {
        return new Response(nursingEnvelopeJson(slecht), { status: 200 });
      }
      return new Response('missing', { status: 404 });
    });
    expect(restored.fileName).toBe('verpleegkunde.json');
    expect(restored.scenario.meta.title).toBe('Slechtnieuwsgesprek oefenen');
  });

  it('labels the case by its name', () => {
    expect(loadedCaseLabel('')).toBe('Geladen: nieuwe casus');
    expect(loadedCaseLabel('   ')).toBe('Geladen: nieuwe casus');
    expect(loadedCaseLabel('Slechtnieuwsgesprek oefenen')).toBe(
      'Geladen: Slechtnieuwsgesprek oefenen',
    );
  });
});
