import { describe, expect, it } from 'vitest';
import { emptyNursingScenario } from '../editor/emptyScenario';
import type { NursingScenario, NursingStep } from './types';
import { nursingReducer } from './reducer';
import { createNursingSession } from './session';

function linkedScenario(): NursingScenario {
  const seed = emptyNursingScenario();
  const base = seed.steps[0];
  if (!base) {
    throw new Error('lege stap ontbreekt');
  }
  const make = (
    id: string,
    question: string,
    placeholder: string,
    next: Record<NursingStep['options'][number]['quality'], string>,
  ): NursingStep => ({
    ...base,
    id,
    question,
    stepVideoMode: 'placeholder',
    stepVideoPlaceholder: placeholder,
    options: base.options.map((option) => ({
      ...option,
      id: `${id}-${option.quality}`,
      text: question,
      nextStepId: next[option.quality],
    })) as NursingStep['options'],
  });
  const steps = [
    make('s1', 'Vraag een', 'Plaatshouder een', {
      high: 's3',
      partial: 's2',
      inappropriate: 's1',
    }),
    make('s2', 'Vraag twee', 'Plaatshouder twee', {
      high: 'completed',
      partial: 's3',
      inappropriate: 'completed',
    }),
    make('s3', 'Vraag drie', 'Plaatshouder drie', {
      high: 'completed',
      partial: 'completed',
      inappropriate: 'completed',
    }),
  ];
  return {
    ...seed,
    meta: { ...seed.meta, startStepId: 's1' },
    steps,
  };
}

function choose(
  scenario: NursingScenario,
  optionId: string,
  session = createNursingSession(new Date('2026-10-01T12:00:00.000Z'), scenario.meta),
) {
  return nursingReducer(session, {
    type: 'select',
    optionId,
    at: '2026-10-01T12:00:01.000Z',
    steps: scenario.steps,
  });
}

describe('nursing lines in the test', () => {
  it('lets good skip ahead, partial take its own line, and wrong repeat the question', () => {
    const scenario = linkedScenario();
    const good = choose(scenario, 's1-high');
    expect(good?.status).toBe('in_progress');
    expect(good?.currentStepId).toBe('s3');

    const partial = choose(scenario, 's1-partial');
    expect(partial?.currentStepId).toBe('s2');

    const wrong = choose(scenario, 's1-inappropriate');
    expect(wrong?.status).toBe('in_progress');
    expect(wrong?.currentStepId).toBe('s1');
    expect(scenario.steps[0]?.stepVideoPlaceholder).toBe('Plaatshouder een');
  });

  it('continues to the next listed step without a line, and ends on the last step', () => {
    const scenario = linkedScenario();
    const onTwo = choose(scenario, 's1-partial');
    const onward = nursingReducer(onTwo, {
      type: 'select',
      optionId: 's2-high',
      at: '2026-10-01T12:00:02.000Z',
      steps: scenario.steps,
    });
    expect(onward?.currentStepId).toBe('s3');
    const done = nursingReducer(onward, {
      type: 'select',
      optionId: 's3-high',
      at: '2026-10-01T12:00:03.000Z',
      steps: scenario.steps,
    });
    expect(done?.status).toBe('completed');
    expect(done?.currentStepId).toBe('s3');
  });
});
