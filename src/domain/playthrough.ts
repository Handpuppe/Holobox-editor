import { conclusionScoreEvents } from './conclusion';
import { simulationReducer } from '../state/simulationReducer';
import type { ClinicalConclusion, Scenario, SimulationSession } from './types';

export function playOptions(
  session: SimulationSession,
  scenario: Scenario,
  optionIds: string[],
  at = '2026-09-12T10:00:00.000Z',
): SimulationSession {
  let current: SimulationSession | null = session;
  for (const optionId of optionIds) {
    current = simulationReducer(current, {
      type: 'select-option',
      optionId,
      scenario,
      at,
    });
    current = simulationReducer(current, { type: 'complete-transition', scenario });
  }
  if (!current) {
    throw new Error('Playthrough verloor de sessie.');
  }
  return current;
}

export function finishWithConclusion(
  session: SimulationSession,
  scenario: Scenario,
  conclusion: ClinicalConclusion,
  at = '2026-09-12T10:20:00.000Z',
): SimulationSession {
  const completed = simulationReducer(session, {
    type: 'submit-conclusion',
    conclusion,
    scenario,
    at,
  });
  if (!completed) {
    throw new Error('Conclusie kon niet worden opgeslagen.');
  }
  return completed;
}

export function optionIdsByQuality(
  scenario: Scenario,
  quality: 'high' | 'partial' | 'inappropriate',
): string[] {
  return scenario.nodes.map((node) => {
    const option = node.options.find((item) => item.quality === quality);
    if (!option) {
      throw new Error(`Geen ${quality}-optie in ${node.id}`);
    }
    return option.id;
  });
}

export function conclusionByQuality(
  scenario: Scenario,
  quality: 'high' | 'partial' | 'inappropriate',
): ClinicalConclusion {
  const pick = (
    fieldId: ClinicalConclusion extends infer T ? keyof Omit<T, 'freeText'> : never,
  ) => {
    const field = scenario.conclusionFields.find((item) => item.id === fieldId);
    const choice = field?.choices.find((item) => item.quality === quality);
    if (!choice) {
      throw new Error(`Geen ${quality}-keuze voor ${fieldId}`);
    }
    return choice.id;
  };
  return {
    primaryDifficulty: pick('primaryDifficulty'),
    dailyLifeEffect: pick('dailyLifeEffect'),
    clientStrengths: pick('clientStrengths'),
    firstObjective: pick('firstObjective'),
    nextStep: pick('nextStep'),
    freeText: {
      dailyLifeEffect: 'Gesprekken thuis en voorlezen zijn bemoeilijkt.',
      firstObjective: 'Communicatie met naasten functioneel ondersteunen.',
    },
  };
}

export function extraConclusionEvents(
  conclusion: ClinicalConclusion,
  scenario: Scenario,
  at = '2026-09-12T10:20:00.000Z',
) {
  return conclusionScoreEvents(conclusion, scenario, new Date(at));
}
