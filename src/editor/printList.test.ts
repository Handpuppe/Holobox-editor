import { describe, expect, it } from 'vitest';
import { emptyNursingScenario } from './emptyScenario';
import { saveAnswerPlaceholder } from './nursingAnswerMedia';
import { assignStepPrimaryMedia, saveStepVideoPlaceholder } from './nursingMedia';
import { nursingPrintList } from './printList';

describe('nursingPrintList', () => {
  it('lists open placeholders with the scenario name, step name and text', () => {
    let draft = emptyNursingScenario();
    draft = {
      ...draft,
      meta: { ...draft.meta, title: 'Allergie op de SEH' },
      steps: draft.steps.map((step, index) =>
        index === 0 ? { ...step, stepName: 'Eerste vraag' } : step,
      ),
    };
    const stepId = draft.steps[0]!.id;
    draft = saveStepVideoPlaceholder(draft, stepId, 'Patiënt zit rechtop.');
    draft = saveAnswerPlaceholder(draft, stepId, 'high', 'Close-up van de meter.');
    draft = saveAnswerPlaceholder(draft, stepId, 'inappropriate', '  ');

    const list = nursingPrintList(draft);

    expect(list.title).toBe('Allergie op de SEH');
    expect(list.steps).toHaveLength(1);
    expect(list.steps[0]?.stepName).toBe('Eerste vraag');
    expect(list.steps[0]?.items.map((item) => item.place)).toEqual([
      'Startvideo van de vraag',
      'Goed antwoord',
      'Verkeerd antwoord',
    ]);
    expect(list.steps[0]?.items[0]?.text).toBe('Patiënt zit rechtop.');
    expect(list.steps[0]?.items[1]?.text).toBe('Close-up van de meter.');
    expect(list.steps[0]?.items[2]?.text).toBe('');
    expect(JSON.stringify(list)).not.toMatch(/ABCDE|SBAR|score/i);
  });

  it('skips a place that already has a video file and a place without placeholder', () => {
    let draft = emptyNursingScenario();
    const stepId = draft.steps[0]!.id;
    draft = saveStepVideoPlaceholder(draft, stepId, 'Deze hoort niet op de lijst.');
    draft = assignStepPrimaryMedia(draft, stepId, 'verpleegkunde/al-opgenomen.mp4');
    draft = saveAnswerPlaceholder(draft, stepId, 'partial', 'Nog filmen.');
    draft.steps[0]!.options[0]!.answerVideoMode = 'video';

    const list = nursingPrintList(draft);

    expect(list.steps).toHaveLength(1);
    expect(list.steps[0]?.stepName).toBe('Stap 1');
    expect(list.steps[0]?.items).toEqual([
      { place: 'Deels goed antwoord', text: 'Nog filmen.' },
    ]);
  });

  it('is empty when every place has a video or no placeholder', () => {
    const list = nursingPrintList(emptyNursingScenario());
    expect(list.title).toBe('');
    expect(list.steps).toEqual([]);
  });
});
