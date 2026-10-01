import { describe, expect, it } from 'vitest';
import { cloneNursingScenario } from './cloneNursing';
import { nursingEnvelopeJson, parseVerpleegkundeEnvelope } from './nursingEnvelope';
import { stepPrimaryMediaPath } from './nursingMedia';
import {
  answerUploadRelativePath,
  assignAnswerVideo,
  optionForQuality,
  optionPrimaryMediaPath,
  saveAnswerPlaceholder,
  scenarioMediaFolderName,
} from './nursingAnswerMedia';

describe('verpleegkunde answer videos', () => {
  it('puts a new upload in the answer folder and leaves existing files where they are', () => {
    const draft = cloneNursingScenario();
    const step = draft.steps[0]!;
    const existing = stepPrimaryMediaPath(draft, step);
    expect(existing).toBeTruthy();
    const folder = scenarioMediaFolderName(draft.meta.title, draft.meta.id);
    expect(folder).toBe(draft.meta.title);
    const uploaded = answerUploadRelativePath(folder, 'partial', 'ademhaling.mp4');
    expect(uploaded).toBe(
      `verpleegkunde/scenarios/${folder}/Antwoorden/Deels goed antwoord/ademhaling.mp4`,
    );
    expect(answerUploadRelativePath(folder, 'high', 'logopedie/erik_basis.png')).toBe(null);
    expect(answerUploadRelativePath(folder, 'inappropriate', '..\\logopedie\\erik.mp4')).toBe(null);

    const next = assignAnswerVideo(draft, step.id, 'partial', uploaded);
    const partial = optionForQuality(next.steps[0]!, 'partial');
    expect(optionPrimaryMediaPath(next, partial)).toBe(uploaded);
    expect(stepPrimaryMediaPath(next, next.steps[0]!)).toBe(existing);
    expect(next.mediaSlots.some((slot) => slot.primaryMedia === existing)).toBe(true);
    const highBefore = optionPrimaryMediaPath(draft, optionForQuality(step, 'high'));
    const highAfter = optionPrimaryMediaPath(next, optionForQuality(next.steps[0]!, 'high'));
    expect(highAfter).toBe(highBefore);
  });

  it('stores placeholder text and still opens a scenario without the three places', () => {
    const draft = cloneNursingScenario();
    const step = draft.steps[0]!;
    expect(optionForQuality(step, 'high')?.answerVideoMode).toBeUndefined();
    expect(optionForQuality(step, 'high')?.videoPlaceholder).toBeUndefined();
    const parsedOld = parseVerpleegkundeEnvelope(nursingEnvelopeJson(draft));
    expect(parsedOld.ok).toBe(true);

    const withNote = saveAnswerPlaceholder(
      draft,
      step.id,
      'inappropriate',
      'Video waarin de student water geeft.',
    );
    const parsed = parseVerpleegkundeEnvelope(nursingEnvelopeJson(withNote));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(optionForQuality(parsed.scenario.steps[0]!, 'inappropriate')?.videoPlaceholder).toBe(
      'Video waarin de student water geeft.',
    );
    expect(optionForQuality(parsed.scenario.steps[0]!, 'inappropriate')?.answerVideoMode).toBe(
      'placeholder',
    );
    expect(stepPrimaryMediaPath(parsed.scenario, parsed.scenario.steps[0]!)).toBe(
      stepPrimaryMediaPath(draft, step),
    );
  });
});
