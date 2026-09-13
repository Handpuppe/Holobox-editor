import {
  CLIENT_EMOTIONS,
  COMPETENCIES,
  COMPETENCY_WEIGHTS,
  CONCLUSION_NODE_ID,
  type Competency,
  type DecisionNode,
  type Scenario,
  type StudentOption,
} from './types';

export class ScenarioValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Scenario-configuratie is ongeldig: ${issues.join('; ')}`);
    this.name = 'ScenarioValidationError';
    this.issues = issues;
  }
}

function unique(values: string[]): boolean {
  return new Set(values).size === values.length;
}

function awardsMatchCompetencies(
  awards: Partial<Record<Competency, 0 | 0.5 | 1>>,
  scored: Competency[],
  label: string,
  issues: string[],
): void {
  for (const competency of scored) {
    if (awards[competency] === undefined) {
      issues.push(`${label} mist een score voor ${competency}.`);
    }
  }
  for (const key of Object.keys(awards) as Competency[]) {
    if (!scored.includes(key)) {
      issues.push(`${label} scoort onverwachte competentie ${key}.`);
    }
  }
}

function validateOption(
  node: DecisionNode,
  option: StudentOption,
  issues: string[],
  nodeIds: Set<string>,
): void {
  if (!option.id || !option.text.trim()) {
    issues.push(`Node ${node.id} heeft een optie zonder id of tekst.`);
  }
  if (option.text.length > 180) {
    issues.push(`Optie ${option.id} is te lang voor een gelijkwaardige keuze.`);
  }
  if (option.nextNodeId !== CONCLUSION_NODE_ID && !nodeIds.has(option.nextNodeId)) {
    issues.push(`Optie ${option.id} verwijst naar onbekende node ${option.nextNodeId}.`);
  }
  if (!CLIENT_EMOTIONS.includes(option.emotion)) {
    issues.push(`Optie ${option.id} heeft een ongeldige emotie.`);
  }
  if (!option.clientResponse.text.trim() || !option.delayedFeedback.trim()) {
    issues.push(`Optie ${option.id} mist cliëntreactie of feedback.`);
  }
  awardsMatchCompetencies(
    option.competencyAwards,
    node.scoredCompetencies,
    `Optie ${option.id}`,
    issues,
  );
}

export function validateScenario(scenario: Scenario): string[] {
  const issues: string[] = [];
  const weightTotal = COMPETENCIES.reduce(
    (sum, competency) => sum + COMPETENCY_WEIGHTS[competency],
    0,
  );
  if (Math.abs(weightTotal - 1) > 1e-10) {
    issues.push('Competentiegewichten tellen niet op tot 100%.');
  }
  if (!scenario.id || !scenario.version || !scenario.rubricVersion) {
    issues.push('Scenario mist identificatie of versie.');
  }
  if (!scenario.client.fictional) {
    issues.push('Cliëntprofiel moet expliciet fictief zijn.');
  }
  if (scenario.nodes.length < 8) {
    issues.push('Scenario heeft minder dan acht beslissingspunten.');
  }
  const nodeIds = scenario.nodes.map((node) => node.id);
  if (!unique(nodeIds)) {
    issues.push('Node-id’s zijn niet uniek.');
  }
  if (!nodeIds.includes(scenario.startNodeId)) {
    issues.push('Startnode ontbreekt.');
  }
  const optionIds = scenario.nodes.flatMap((node) => node.options.map((option) => option.id));
  if (!unique(optionIds)) {
    issues.push('Optie-id’s zijn niet uniek.');
  }
  const nodeIdSet = new Set(nodeIds);
  for (const node of scenario.nodes) {
    if (node.options.length !== 3) {
      issues.push(`Node ${node.id} heeft geen drie opties.`);
    }
    const qualities = node.options.map((option) => option.quality).sort();
    if (qualities.join() !== 'high,inappropriate,partial') {
      issues.push(`Node ${node.id} mist de drie kwaliteitsniveaus.`);
    }
    if (node.scoredCompetencies.length === 0) {
      issues.push(`Node ${node.id} scoort geen competenties.`);
    }
    for (const option of node.options) {
      validateOption(node, option, issues, nodeIdSet);
    }
  }
  if (scenario.conclusionFields.length < 5) {
    issues.push('Conclusieformulier is onvolledig.');
  }
  const conclusionChoiceIds = scenario.conclusionFields.flatMap((field) =>
    field.choices.map((choice) => choice.id),
  );
  if (!unique(conclusionChoiceIds)) {
    issues.push('Conclusiekeuze-id’s zijn niet uniek.');
  }
  for (const field of scenario.conclusionFields) {
    const qualities = field.choices.map((choice) => choice.quality).sort();
    if (qualities.join() !== 'high,inappropriate,partial') {
      issues.push(`Conclusieveld ${field.id} mist de drie kwaliteitsniveaus.`);
    }
    for (const choice of field.choices) {
      awardsMatchCompetencies(
        choice.competencyAwards,
        field.scoredCompetencies,
        `Conclusiekeuze ${choice.id}`,
        issues,
      );
    }
  }
  return issues;
}

export function assertValidScenario(scenario: Scenario): void {
  const issues = validateScenario(scenario);
  if (issues.length > 0) {
    throw new ScenarioValidationError(issues);
  }
}
