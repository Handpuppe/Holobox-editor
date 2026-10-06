import { describe, expect, it } from 'vitest';
import { emptyNursingScenario } from './emptyScenario';
import { connectNursingFlow } from './nodeBoard';
import { appendNursingStep, removeNursingQuestion } from './nursingSteps';

describe('nursing steps', () => {
  it('names the next node question with the next number', () => {
    let scenario = emptyNursingScenario();
    scenario = appendNursingStep(scenario).scenario;
    scenario = appendNursingStep(scenario).scenario;
    const added = appendNursingStep(scenario);
    expect(scenario.steps).toHaveLength(3);
    expect(added.step.stepName).toBe('Vraag.4');
    expect(added.step.questionFolder).toBe('gesprekstechnieken/scenario-Vraag4');
    expect(scenario.steps[0]?.questionFolder).toBeUndefined();
    expect(added.scenario.steps.map((step) => step.stepName)).toEqual([
      'Vraag.1',
      'Vraag.2',
      'Vraag.3',
      'Vraag.4',
    ]);
  });

  it('removes one question and only the lines that used it', () => {
    let scenario = emptyNursingScenario();
    const first = scenario.steps[0]!.id;
    const added = appendNursingStep(scenario);
    scenario = added.scenario;
    const second = added.step.id;
    scenario = connectNursingFlow(scenario, `a-out-${first}-high`, `q-in-${second}`);
    scenario = connectNursingFlow(scenario, `a-out-${first}-partial`, `q-in-${first}`);
    scenario = connectNursingFlow(scenario, `a-out-${second}-inappropriate`, `q-in-${first}`);

    const next = removeNursingQuestion(scenario, second);
    const kept = next.steps[0];
    expect(next.steps.map((step) => step.id)).toEqual([first]);
    expect(kept?.options.find((option) => option.quality === 'high')?.nextStepId).toBe('completed');
    expect(kept?.options.find((option) => option.quality === 'partial')?.nextStepId).toBe(first);
    expect(kept?.options.find((option) => option.quality === 'inappropriate')?.nextStepId).toBe(
      'completed',
    );
    expect(removeNursingQuestion(next, first)).toBe(next);
  });
});
