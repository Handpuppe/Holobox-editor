import { describe, expect, it } from 'vitest';
import { aphasiaIntakeScenario } from '../data/aphasiaIntakeScenario';
import { cloneNursingScenario } from './cloneNursing';
import { cloneScenario } from './cloneScenario';
import { assignStepPrimaryMedia } from './nursingMedia';
import { logopedieSaveIssues, nursingSaveIssues } from './saveChecks';

describe('editor save checks', () => {
  it('accepts the shipped Logopedie and Verpleegkunde copies', () => {
    expect(logopedieSaveIssues(aphasiaIntakeScenario)).toEqual([]);
    expect(nursingSaveIssues(cloneNursingScenario())).toEqual([]);
  });

  it('lists a missing Logopedie question, good answer and next step', () => {
    const draft = cloneScenario();
    draft.nodes[0]!.prompt.text = '   ';
    draft.nodes[0]!.options[0]!.quality = 'partial';
    draft.nodes[0]!.options[1]!.quality = 'partial';
    draft.nodes[0]!.options[2]!.quality = 'inappropriate';
    draft.nodes[0]!.options[0]!.nextNodeId = 'niet-bestaand';
    const issues = logopedieSaveIssues(draft);
    expect(issues.some((item) => item.includes('stap zonder vraagtekst'))).toBe(true);
    expect(issues.some((item) => item.includes('geen goed (high) antwoord'))).toBe(true);
    expect(issues.some((item) => item.includes('ontbrekende volgende stap'))).toBe(true);
  });

  it('lists a Verpleegkunde step without question, good answer, next step or video', () => {
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
    expect(issues.some((item) => item.includes('geen goed (high) antwoord'))).toBe(true);
    expect(issues.some((item) => item.includes('ontbrekende volgende stap'))).toBe(true);
    expect(issues.some((item) => item.includes('zonder video'))).toBe(true);
  });

  it('treats a staged video delete as a missing video', () => {
    const draft = cloneNursingScenario();
    const path = draft.mediaSlots.find(
      (slot) => slot.slotId === draft.steps[0]?.mediaSlotId,
    )?.primaryMedia;
    expect(path).toBeTruthy();
    const issues = nursingSaveIssues(draft, [{ type: 'delete', relativePath: path ?? '' }]);
    expect(issues.some((item) => item.includes('zonder video'))).toBe(true);
  });
});
