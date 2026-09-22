import { describe, expect, it } from 'vitest';
import { nursingReducer } from './reducer';
import { calculateNursingScores, nursingWeightTotal, optionIdsByQuality } from './scoring';
import { createNursingSession } from './session';
import { nursingSteps } from './scenario';

function play(quality: 'high' | 'partial' | 'inappropriate') {
  let session: ReturnType<typeof createNursingSession> | null = createNursingSession(
    new Date('2026-09-12T12:00:00.000Z'),
  );
  for (const optionId of optionIdsByQuality(quality)) {
    session = nursingReducer(session, {
      type: 'select',
      optionId,
      at: '2026-09-12T12:00:00.000Z',
    });
    if (!session) {
      throw new Error('sessie verloren');
    }
  }
  return session;
}

describe('nursing scoring', () => {
  it('keeps weights at 100%', () => {
    expect(nursingWeightTotal()).toBeCloseTo(1, 10);
  });

  it('has ten scored steps', () => {
    expect(nursingSteps.length).toBe(10);
  });

  it('scores 100 on the safe route', () => {
    const session = play('high');
    expect(session?.status).toBe('completed');
    expect(calculateNursingScores(session?.history ?? []).total).toBe(100);
    expect(session?.criticalErrors).toEqual([]);
  });

  it('scores 0 on the unsafe route', () => {
    const session = play('inappropriate');
    expect(calculateNursingScores(session?.history ?? []).total).toBe(0);
    expect(session?.criticalErrors.length).toBeGreaterThan(0);
  });

  it('uses supplied steps for the maximum without changing the formula', () => {
    const session = play('high');
    expect(calculateNursingScores(session?.history ?? [], nursingSteps).total).toBe(100);
    expect(calculateNursingScores(session?.history ?? []).total).toBe(
      calculateNursingScores(session?.history ?? [], nursingSteps).total,
    );
  });
});
