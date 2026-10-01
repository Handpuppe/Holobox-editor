import { describe, expect, it } from 'vitest';
import { aphasiaIntakeScenario } from '../data/aphasiaIntakeScenario';
import { cloneNursingScenario } from './cloneNursing';
import { cloneScenario } from './cloneScenario';
import { emptyNursingScenario } from './emptyScenario';
import { nursingEnvelopeJson, parseVerpleegkundeEnvelope } from './nursingEnvelope';
import { assignStepPrimaryMedia } from './nursingMedia';
import { logopedieSaveIssues, nursingSaveIssues } from './saveChecks';

describe('editor save checks', () => {
  it('accepts the shipped Logopedie and Verpleegkunde copies', () => {
    expect(logopedieSaveIssues(aphasiaIntakeScenario)).toEqual([]);
    expect(nursingSaveIssues(cloneNursingScenario())).toEqual([]);
  });

  it('lists a missing Logopedie question and good answer without a next step', () => {
    const draft = cloneScenario();
    draft.nodes[0]!.prompt.text = '   ';
    draft.nodes[0]!.options[0]!.quality = 'partial';
    draft.nodes[0]!.options[1]!.quality = 'partial';
    draft.nodes[0]!.options[2]!.quality = 'inappropriate';
    draft.nodes[0]!.options[0]!.nextNodeId = 'niet-bestaand';
    const issues = logopedieSaveIssues(draft);
    expect(issues.some((item) => item.includes('stap zonder vraagtekst'))).toBe(true);
    expect(issues.some((item) => item.includes('geen goed antwoord'))).toBe(true);
    expect(issues.some((item) => item.includes('ontbrekende volgende stap'))).toBe(false);
    expect(issues.some((item) => item.includes('niet-bestaand'))).toBe(false);
  });

  it('lists a Verpleegkunde step without question or good answer, and ignores video and the next step', () => {
    const draft = cloneNursingScenario();
    const first = draft.steps[0]!;
    first.question = '';
    first.options[0]!.quality = 'partial';
    first.options[1]!.quality = 'partial';
    first.options[2]!.quality = 'inappropriate';
    first.options[0]!.nextStepId = 'niet-bestaand';
    const unlinked = assignStepPrimaryMedia(draft, first.id, null);
    unlinked.steps[0]!.question = '';
    unlinked.steps[0]!.options[0]!.quality = 'partial';
    unlinked.steps[0]!.options[1]!.quality = 'partial';
    unlinked.steps[0]!.options[2]!.quality = 'inappropriate';
    unlinked.steps[0]!.options[0]!.nextStepId = 'niet-bestaand';
    const issues = nursingSaveIssues(unlinked);
    expect(issues.some((item) => item.includes('stap zonder vraagtekst'))).toBe(true);
    expect(issues.some((item) => item.includes('geen goed antwoord'))).toBe(true);
    expect(issues.some((item) => item.includes('ontbrekende volgende stap'))).toBe(false);
    expect(issues.some((item) => item.includes('zonder video'))).toBe(false);
    expect(issues.some((item) => item.includes(first.id))).toBe(false);
  });

  it('does not block save when a linked video is staged for deletion', () => {
    const draft = cloneNursingScenario();
    const path = draft.mediaSlots.find(
      (slot) => slot.slotId === draft.steps[0]?.mediaSlotId,
    )?.primaryMedia;
    expect(path).toBeTruthy();
    const issues = nursingSaveIssues(draft, [{ type: 'delete', relativePath: path ?? '' }]);
    expect(issues).toEqual([]);
  });

  it('accepts one empty-editor step once text and a saved placeholder are filled', () => {
    const draft = emptyNursingScenario();
    draft.patient.name = 'Testpatiënt';
    draft.meta.educationType = 'Eigen type onderwijs';
    const step = draft.steps[0]!;
    step.stepName = 'Naam';
    step.phaseLabel = 'Fase';
    step.question = 'Eigen vraag';
    step.stepVideoMode = 'placeholder';
    step.stepVideoPlaceholder = 'Video volgt later.';
    for (const option of step.options) {
      option.text = option.quality;
    }
    expect(nursingSaveIssues(draft)).toEqual([]);
    const parsed = parseVerpleegkundeEnvelope(nursingEnvelopeJson(draft));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.scenario.steps).toHaveLength(1);
    expect(parsed.scenario.meta.educationType).toBe('Eigen type onderwijs');
    expect(parsed.scenario.steps[0]?.stepVideoPlaceholder).toBe('Video volgt later.');
    expect(parsed.scenario.steps[0]?.options[0]?.criticalError).toBeUndefined();
  });

  it('skips a blank extra step and still opens that draft', () => {
    const draft = emptyNursingScenario();
    draft.patient.name = 'Testpatiënt';
    const step = draft.steps[0]!;
    step.stepName = 'Naam';
    step.phaseLabel = 'Situatie';
    step.question = 'Vraag';
    for (const option of step.options) {
      option.text = option.quality;
    }
    const extra = structuredClone(draft.steps[0]!);
    extra.id = 'n-extra-1';
    extra.stepName = '';
    extra.phaseLabel = '';
    extra.question = '';
    extra.help = '';
    extra.mediaSlotId = 'nursing-step-n-extra-1';
    extra.options = [
      { ...extra.options[0], id: 'n-extra-1-high', text: '' },
      { ...extra.options[1], id: 'n-extra-1-partial', text: '' },
      { ...extra.options[2], id: 'n-extra-1-inappropriate', text: '' },
    ];
    draft.steps.push(extra);
    const issues = nursingSaveIssues(draft);
    expect(issues).toEqual([]);
    expect(issues.some((item) => item.includes('n-extra') || item.includes('n-1'))).toBe(false);
    const parsed = parseVerpleegkundeEnvelope(nursingEnvelopeJson(draft));
    expect(parsed.ok).toBe(true);
  });

  it('still requires the first step when a later step is blank', () => {
    const draft = emptyNursingScenario();
    const extra = structuredClone(draft.steps[0]!);
    extra.id = 'n-extra-1';
    extra.mediaSlotId = 'nursing-step-n-extra-1';
    extra.options = [
      { ...extra.options[0], id: 'n-extra-1-high', text: '' },
      { ...extra.options[1], id: 'n-extra-1-partial', text: '' },
      { ...extra.options[2], id: 'n-extra-1-inappropriate', text: '' },
    ];
    draft.steps.push(extra);
    const issues = nursingSaveIssues(draft);
    expect(issues.some((item) => item.includes('Patiëntnaam'))).toBe(true);
    expect(issues.some((item) => item.includes('situatiebeschrijving'))).toBe(true);
    expect(issues.some((item) => item.includes('stap zonder vraagtekst'))).toBe(true);
    expect(issues.some((item) => item.includes('stap zonder naam'))).toBe(true);
    expect(issues.some((item) => item.includes('geen goed antwoord'))).toBe(true);
    expect(issues.some((item) => item.includes('zonder video'))).toBe(false);
    expect(issues.some((item) => item.includes('volgende stap'))).toBe(false);
    expect(issues.some((item) => item.includes('competent'))).toBe(false);
    expect(issues.some((item) => item.includes('n-1') || item.includes('n-extra'))).toBe(false);
  });
});
