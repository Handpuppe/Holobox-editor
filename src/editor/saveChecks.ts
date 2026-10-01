import { validateScenario } from '../domain/scenarioValidation';
import type { Scenario } from '../domain/types';
import type { NursingScenario, NursingStep } from '../nursing/types';
import { envelopeJson } from './envelope';
import { nursingEnvelopeJson } from './nursingEnvelope';
import type { StagedNursingMediaOp } from './nursingMedia';

function uniqueIssues(issues: string[]): string[] {
  return [...new Set(issues)];
}

function envelopeLooksValid(text: string, moduleId: 'logopedie' | 'verpleegkunde'): boolean {
  try {
    const data = JSON.parse(text) as { schemaVersion?: unknown; module?: unknown };
    return data.schemaVersion === 1 && data.module === moduleId;
  } catch {
    return false;
  }
}

function editorSkipsIssue(issue: string): boolean {
  const text = issue.toLowerCase();
  return (
    text.includes('volgende stap') ||
    text.includes('onbekende node') ||
    text.includes('competent') ||
    text.includes('gewicht') ||
    text.includes('veilig') ||
    text.includes('mist een score')
  );
}

export function logopedieSaveIssues(scenario: Scenario): string[] {
  const issues: string[] = [];
  try {
    if (!envelopeLooksValid(envelopeJson(scenario), 'logopedie')) {
      issues.push('Ongeldige JSON-structuur.');
    }
  } catch {
    issues.push('Ongeldige JSON-structuur.');
  }
  if (!Array.isArray(scenario.nodes) || scenario.nodes.length === 0) {
    issues.push('Ongeldige JSON-structuur: scenario mist stappen.');
  }
  for (const [index, node] of (scenario.nodes ?? []).entries()) {
    const label = node.phaseLabel?.trim() || `Vraag ${index + 1}`;
    if (!node.prompt?.text?.trim()) {
      issues.push(`${label}: stap zonder vraagtekst.`);
    }
    const hasGood = (node.options ?? []).some(
      (option) => option.quality === 'high' && option.text.trim(),
    );
    if (!hasGood) {
      issues.push(`${label}: geen goed antwoord.`);
    }
  }
  issues.push(...validateScenario(scenario).filter((issue) => !editorSkipsIssue(issue)));
  return uniqueIssues(issues);
}

function isBlankNursingStep(step: NursingStep): boolean {
  return (
    !step.stepName?.trim() &&
    !step.phaseLabel?.trim() &&
    !step.question?.trim() &&
    (step.options ?? []).every((option) => !option.text?.trim())
  );
}

function stepNameMissing(step: NursingStep): boolean {
  return typeof step.stepName === 'string' && !step.stepName.trim();
}

function nursingStepLabel(step: NursingStep, index: number): string {
  return step.stepName?.trim() || step.phaseLabel?.trim() || `Stap ${index + 1}`;
}

export function nursingSaveIssues(
  scenario: NursingScenario,
  _staged: StagedNursingMediaOp[] = [],
): string[] {
  const issues: string[] = [];
  try {
    if (!envelopeLooksValid(nursingEnvelopeJson(scenario), 'verpleegkunde')) {
      issues.push('Ongeldige JSON-structuur.');
    }
  } catch {
    issues.push('Ongeldige JSON-structuur.');
  }
  if (!Array.isArray(scenario.steps) || scenario.steps.length === 0) {
    issues.push('Ongeldige JSON-structuur: scenario mist stappen.');
  }
  if (!scenario.patient?.name?.trim()) {
    issues.push('Patiëntnaam ontbreekt.');
  }
  for (const [index, step] of (scenario.steps ?? []).entries()) {
    if (index > 0 && isBlankNursingStep(step)) {
      continue;
    }
    const label = nursingStepLabel(step, index);
    if (stepNameMissing(step)) {
      issues.push(`${label}: stap zonder naam.`);
    }
    if (!step.phaseLabel?.trim()) {
      issues.push(`${label}: situatiebeschrijving ontbreekt.`);
    }
    if (!step.question?.trim()) {
      issues.push(`${label}: stap zonder vraagtekst.`);
    }
    const hasGood = (step.options ?? []).some(
      (option) => option.quality === 'high' && option.text.trim(),
    );
    if (!hasGood) {
      issues.push(`${label}: geen goed antwoord.`);
    }
    for (const option of step.options ?? []) {
      if (!option.text?.trim() && option.quality === 'partial') {
        issues.push(`${label}: geen deels goed antwoord.`);
      }
      if (!option.text?.trim() && option.quality === 'inappropriate') {
        issues.push(`${label}: geen verkeerd antwoord.`);
      }
    }
  }
  return uniqueIssues(issues);
}
