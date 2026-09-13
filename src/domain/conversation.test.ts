import { describe, expect, it } from 'vitest';
import { aphasiaIntakeScenario } from '../data/aphasiaIntakeScenario';
import { optionIdsByQuality, playOptions } from './playthrough';
import { createSession } from './session';
import { simulationReducer } from '../state/simulationReducer';

describe('conversation branching and client state', () => {
  it('contains at least eight decision points', () => {
    expect(aphasiaIntakeScenario.nodes.length).toBeGreaterThanOrEqual(8);
  });

  it('follows nextNodeId for each selected option', () => {
    const start = createSession(aphasiaIntakeScenario, new Date('2026-09-12T10:00:00.000Z'));
    const option = aphasiaIntakeScenario.nodes[0]?.options[1];
    if (!option) {
      throw new Error('Startoptie ontbreekt.');
    }
    const selected = simulationReducer(start, {
      type: 'select-option',
      optionId: option.id,
      scenario: aphasiaIntakeScenario,
      at: '2026-09-12T10:00:01.000Z',
    });
    expect(selected?.queuedNodeId).toBe(option.nextNodeId);
    const next = simulationReducer(selected, {
      type: 'complete-transition',
      scenario: aphasiaIntakeScenario,
    });
    expect(next?.currentNodeId).toBe(option.nextNodeId);
  });

  it('changes emotion after a confusing double question', () => {
    const start = createSession(aphasiaIntakeScenario, new Date('2026-09-12T10:00:00.000Z'));
    const after = playOptions(start, aphasiaIntakeScenario, ['d1-high', 'd2-low']);
    expect(after.history.at(-1)?.emotion).toBe('confused');
    expect(after.flags.usedLongQuestions).toBe(true);
  });

  it('lets Erik continue independently when given time', () => {
    const start = createSession(aphasiaIntakeScenario, new Date('2026-09-12T10:00:00.000Z'));
    const after = playOptions(start, aphasiaIntakeScenario, ['d1-high', 'd2-high', 'd3-high']);
    expect(after.flags.gaveResponseTime).toBe(true);
    expect(after.history.at(-1)?.clientResponse).toContain('Bus');
  });

  it('makes Erik more withdrawn when sentences are finished', () => {
    const start = createSession(aphasiaIntakeScenario, new Date('2026-09-12T10:00:00.000Z'));
    const after = playOptions(start, aphasiaIntakeScenario, ['d1-high', 'd2-high', 'd3-low']);
    expect(after.flags.finishedSentences).toBe(true);
    expect(after.history.at(-1)?.emotion).toBe('frustrated');
  });

  it('relaxes Erik when frustration is acknowledged', () => {
    const start = createSession(aphasiaIntakeScenario, new Date('2026-09-12T10:00:00.000Z'));
    const after = playOptions(start, aphasiaIntakeScenario, [
      'd1-high',
      'd2-high',
      'd3-high',
      'd4-high',
      'd5-high',
      'd6-high',
      'd7-high',
    ]);
    expect(after.flags.acknowledgedFrustration).toBe(true);
    expect(after.history.at(-1)?.emotion).toBe('reassured');
  });

  it('raises fatigue after too many uninterrupted heavy questions', () => {
    const start = createSession(aphasiaIntakeScenario, new Date('2026-09-12T10:00:00.000Z'));
    const after = playOptions(
      start,
      aphasiaIntakeScenario,
      optionIdsByQuality(aphasiaIntakeScenario, 'inappropriate'),
    );
    expect(after.fatigueLevel).toBeGreaterThanOrEqual(2);
    expect(['fatigued', 'frustrated', 'confused']).toContain(after.clientEmotion);
  });

  it('prevents a second selection while a transition is processing', () => {
    const start = createSession(aphasiaIntakeScenario, new Date('2026-09-12T10:00:00.000Z'));
    const first = simulationReducer(start, {
      type: 'select-option',
      optionId: 'd1-high',
      scenario: aphasiaIntakeScenario,
      at: '2026-09-12T10:00:01.000Z',
    });
    const second = simulationReducer(first, {
      type: 'select-option',
      optionId: 'd1-low',
      scenario: aphasiaIntakeScenario,
      at: '2026-09-12T10:00:01.100Z',
    });
    expect(first?.history).toHaveLength(1);
    expect(second?.history).toHaveLength(1);
    expect(second?.history[0]?.optionId).toBe('d1-high');
  });
});
