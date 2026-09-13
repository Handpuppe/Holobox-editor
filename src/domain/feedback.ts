import {
  COMPETENCIES,
  type ResultFeedback,
  type Scenario,
  type ScoreEvent,
  type ScoreSummary,
} from './types';

const COMPETENCY_LABELS: Record<(typeof COMPETENCIES)[number], string> = {
  adaptedCommunication: 'aangepaste communicatie',
  historyTakingAndGoals: 'anamnese en cliëntdoelen',
  observation: 'observatie',
  clinicalReasoning: 'klinisch redeneren',
  empathyAndProfessionalBehaviour: 'empathie en professioneel gedrag',
};

export function buildFeedback(
  events: ScoreEvent[],
  scenario: Scenario,
  scores: ScoreSummary,
): ResultFeedback {
  const decisionEvents = events.filter((event) => !event.nodeId.startsWith('conclusion-'));
  const strengths: string[] = [];
  const improvements: string[] = [];

  for (const competency of COMPETENCIES) {
    const score = scores.competencies[competency];
    if (score.percent >= 80) {
      strengths.push(`Je scoorde sterk op ${COMPETENCY_LABELS[competency]}.`);
    } else if (score.percent <= 50) {
      improvements.push(`Besteed meer aandacht aan ${COMPETENCY_LABELS[competency]}.`);
    }
  }

  for (const event of decisionEvents) {
    const node = scenario.nodes.find((item) => item.id === event.nodeId);
    if (!node) {
      continue;
    }
    const chosen = node.options.find((option) => option.id === event.optionId);
    if (!chosen) {
      continue;
    }
    if (event.quality === 'high' && strengths.length < 3) {
      strengths.push(chosen.delayedFeedback);
    }
    if ((event.quality === 'inappropriate' || event.unsafe) && improvements.length < 3) {
      improvements.push(chosen.delayedFeedback);
    }
  }

  if (strengths.length < 3) {
    for (const event of decisionEvents) {
      if (event.quality === 'partial' && strengths.length < 3) {
        strengths.push(event.delayedFeedback);
      }
    }
  }

  const uniqueStrengths = [...new Set(strengths)].slice(0, 3);
  const uniqueImprovements = [...new Set(improvements)].slice(0, 3);

  while (uniqueStrengths.length < 3) {
    uniqueStrengths.push(
      'Je hebt de intake afgerond en daarmee een eerste beeld van de cliënt gevormd.',
    );
    if (uniqueStrengths.length >= 3) {
      break;
    }
  }

  const timeline = decisionEvents.map((event) => {
    const node = scenario.nodes.find((item) => item.id === event.nodeId);
    const option = node?.options.find((item) => item.id === event.optionId);
    return {
      nodeId: event.nodeId,
      phaseLabel: node?.phaseLabel ?? event.nodeId,
      choice: option?.text ?? event.optionId,
      quality: event.quality,
    };
  });

  const keyDecisions = decisionEvents.map((event) => event.educationalRationale).slice(0, 8);

  const assumptionEvent = events.find(
    (event) => event.unsafe || event.educationalRationale.toLowerCase().includes('aanname'),
  );
  const observationVersusAssumption = assumptionEvent
    ? assumptionEvent.delayedFeedback
    : 'Je hebt waarneming en interpretatie in deze poging grotendeels gescheiden gehouden. Blijf benoemen wat je ziet of hoort, en toets wat je denkt.';

  const missedHigh = scenario.nodes
    .map((node) => {
      const chosenId = decisionEvents.find((event) => event.nodeId === node.id)?.optionId;
      const high = node.options.find((option) => option.quality === 'high');
      if (!high || chosenId === high.id) {
        return null;
      }
      return high;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const strongerApproach =
    missedHigh[0]?.text ??
    'Gebruik korte zinnen, stel één vraag tegelijk, geef tijd en toets je samenvatting bij de cliënt.';

  return {
    strengths: uniqueStrengths,
    improvements: uniqueImprovements,
    timeline,
    keyDecisions,
    observationVersusAssumption,
    strongerApproach: `Een sterkere aanpak was bijvoorbeeld: “${strongerApproach}”`,
  };
}
