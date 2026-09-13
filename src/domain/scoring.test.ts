import { describe, expect, it } from 'vitest';
import { aphasiaIntakeScenario } from '../data/aphasiaIntakeScenario';
import {
  conclusionByQuality,
  extraConclusionEvents,
  optionIdsByQuality,
  playOptions,
} from './playthrough';
import { calculateScores, clampScore, competencyWeightTotal, maximumAwards } from './scoring';
import { createSession } from './session';
import { COMPETENCIES } from './types';

describe('scoring model', () => {
  it('keeps competency weights at exactly 100%', () => {
    expect(competencyWeightTotal()).toBeCloseTo(1, 10);
  });

  it('clamps scores between 0 and 100', () => {
    expect(clampScore(-12)).toBe(0);
    expect(clampScore(140)).toBe(100);
    expect(clampScore(Number.NaN)).toBe(0);
  });

  it('gives 100 on the full-score route', () => {
    const session = playOptions(
      createSession(aphasiaIntakeScenario, new Date('2026-09-12T10:00:00.000Z')),
      aphasiaIntakeScenario,
      optionIdsByQuality(aphasiaIntakeScenario, 'high'),
    );
    const conclusion = conclusionByQuality(aphasiaIntakeScenario, 'high');
    const events = [
      ...session.history,
      ...extraConclusionEvents(conclusion, aphasiaIntakeScenario),
    ];
    const scores = calculateScores(events, aphasiaIntakeScenario);
    expect(scores.total).toBe(100);
    for (const competency of COMPETENCIES) {
      expect(scores.competencies[competency].percent).toBe(100);
    }
  });

  it('gives 0 on the zero-score route', () => {
    const session = playOptions(
      createSession(aphasiaIntakeScenario, new Date('2026-09-12T10:00:00.000Z')),
      aphasiaIntakeScenario,
      optionIdsByQuality(aphasiaIntakeScenario, 'inappropriate'),
    );
    const conclusion = conclusionByQuality(aphasiaIntakeScenario, 'inappropriate');
    const events = [
      ...session.history,
      ...extraConclusionEvents(conclusion, aphasiaIntakeScenario),
    ];
    const scores = calculateScores(events, aphasiaIntakeScenario);
    expect(scores.total).toBe(0);
    for (const competency of COMPETENCIES) {
      expect(scores.competencies[competency].percent).toBe(0);
    }
  });

  it('scores a mixed route with half points', () => {
    const session = playOptions(
      createSession(aphasiaIntakeScenario, new Date('2026-09-12T10:00:00.000Z')),
      aphasiaIntakeScenario,
      optionIdsByQuality(aphasiaIntakeScenario, 'partial'),
    );
    const conclusion = conclusionByQuality(aphasiaIntakeScenario, 'partial');
    const events = [
      ...session.history,
      ...extraConclusionEvents(conclusion, aphasiaIntakeScenario),
    ];
    const scores = calculateScores(events, aphasiaIntakeScenario);
    expect(scores.total).toBe(50);
    for (const competency of COMPETENCIES) {
      expect(scores.competencies[competency].percent).toBe(50);
    }
  });

  it('counts unanswered nodes as zero toward the maximum', () => {
    const conclusion = conclusionByQuality(aphasiaIntakeScenario, 'high');
    const events = extraConclusionEvents(conclusion, aphasiaIntakeScenario);
    const scores = calculateScores(events, aphasiaIntakeScenario);
    expect(scores.total).toBeGreaterThanOrEqual(0);
    expect(scores.total).toBeLessThan(100);
    const max = maximumAwards(aphasiaIntakeScenario);
    expect(scores.competencies.adaptedCommunication.max).toBe(max.adaptedCommunication);
  });
});
