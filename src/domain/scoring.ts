import {
  COMPETENCIES,
  COMPETENCY_WEIGHTS,
  type Competency,
  type CompetencyScore,
  type Scenario,
  type ScoreEvent,
  type ScoreSummary,
} from './types';

export function competencyWeightTotal(): number {
  return COMPETENCIES.reduce((sum, competency) => sum + COMPETENCY_WEIGHTS[competency], 0);
}

export function emptyAwards(): Record<Competency, number> {
  return {
    adaptedCommunication: 0,
    historyTakingAndGoals: 0,
    observation: 0,
    clinicalReasoning: 0,
    empathyAndProfessionalBehaviour: 0,
  };
}

export function maximumAwards(scenario: Scenario): Record<Competency, number> {
  const max = emptyAwards();
  for (const node of scenario.nodes) {
    for (const competency of node.scoredCompetencies) {
      max[competency] += 1;
    }
  }
  for (const field of scenario.conclusionFields) {
    for (const competency of field.scoredCompetencies) {
      max[competency] += 1;
    }
  }
  return max;
}

export function earnedAwards(events: ScoreEvent[]): Record<Competency, number> {
  const earned = emptyAwards();
  for (const event of events) {
    for (const competency of COMPETENCIES) {
      const value = event.competencyAwards[competency];
      if (typeof value === 'number') {
        earned[competency] += value;
      }
    }
  }
  return earned;
}

export function clampScore(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, value));
}

export function calculateScores(events: ScoreEvent[], scenario: Scenario): ScoreSummary {
  const max = maximumAwards(scenario);
  const earned = earnedAwards(events);
  const competencies = {} as Record<Competency, CompetencyScore>;
  let weighted = 0;

  for (const competency of COMPETENCIES) {
    const percent = max[competency] === 0 ? 0 : (earned[competency] / max[competency]) * 100;
    const bounded = clampScore(percent);
    competencies[competency] = {
      competency,
      earned: earned[competency],
      max: max[competency],
      percent: bounded,
      weight: COMPETENCY_WEIGHTS[competency],
    };
    weighted += bounded * COMPETENCY_WEIGHTS[competency];
  }

  return {
    total: Math.round(clampScore(weighted)),
    competencies,
  };
}

export function eventsForIdealRoute(scenario: Scenario): {
  nodeOptionIds: string[];
  conclusionChoiceIds: string[];
} {
  const nodeOptionIds = scenario.nodes.map((node) => {
    const option = node.options.find((item) => item.quality === 'high');
    if (!option) {
      throw new Error(`Node ${node.id} has no highly appropriate option.`);
    }
    return option.id;
  });
  const conclusionChoiceIds = scenario.conclusionFields.map((field) => {
    const choice = field.choices.find((item) => item.quality === 'high');
    if (!choice) {
      throw new Error(`Conclusion field ${field.id} has no highly appropriate choice.`);
    }
    return choice.id;
  });
  return { nodeOptionIds, conclusionChoiceIds };
}

export function eventsForPoorRoute(scenario: Scenario): {
  nodeOptionIds: string[];
  conclusionChoiceIds: string[];
} {
  const nodeOptionIds = scenario.nodes.map((node) => {
    const option = node.options.find((item) => item.quality === 'inappropriate');
    if (!option) {
      throw new Error(`Node ${node.id} has no inappropriate option.`);
    }
    return option.id;
  });
  const conclusionChoiceIds = scenario.conclusionFields.map((field) => {
    const choice = field.choices.find((item) => item.quality === 'inappropriate');
    if (!choice) {
      throw new Error(`Conclusion field ${field.id} has no inappropriate choice.`);
    }
    return choice.id;
  });
  return { nodeOptionIds, conclusionChoiceIds };
}
