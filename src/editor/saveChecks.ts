import { validateScenario } from '../domain/scenarioValidation';
import { CONCLUSION_NODE_ID, type Scenario } from '../domain/types';
import { validateNursingScenario } from '../nursing/validateNursing';
import type { NursingScenario } from '../nursing/types';
import { envelopeJson } from './envelope';
import { nursingEnvelopeJson } from './nursingEnvelope';
import { stepPrimaryMediaPath, type StagedNursingMediaOp } from './nursingMedia';

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
  const nodeIds = new Set((scenario.nodes ?? []).map((node) => node.id));
  for (const node of scenario.nodes ?? []) {
    const label = node.phaseLabel?.trim() || node.id;
    if (!node.prompt?.text?.trim()) {
      issues.push(`${label}: stap zonder vraagtekst.`);
    }
    const hasGood = (node.options ?? []).some(
      (option) => option.quality === 'high' && option.text.trim(),
    );
    if (!hasGood) {
      issues.push(`${label}: geen goed (high) antwoord.`);
    }
    for (const option of node.options ?? []) {
      const next = option.nextNodeId?.trim() ?? '';
      if (!next) {
        issues.push(`${label}: ontbrekende volgende stap.`);
        continue;
      }
      if (next !== CONCLUSION_NODE_ID && !nodeIds.has(next)) {
        issues.push(`${label}: ontbrekende volgende stap (${next}).`);
      }
    }
  }
  issues.push(...validateScenario(scenario));
  return uniqueIssues(issues);
}

function stepHasVideo(
  scenario: NursingScenario,
  stepId: string,
  staged: StagedNursingMediaOp[],
): boolean {
  const step = scenario.steps.find((item) => item.id === stepId);
  if (!step) {
    return false;
  }
  const path = stepPrimaryMediaPath(scenario, step);
  if (!path) {
    return false;
  }
  if (staged.some((op) => op.type === 'delete' && op.relativePath === path)) {
    return false;
  }
  return true;
}

export function nursingSaveIssues(
  scenario: NursingScenario,
  staged: StagedNursingMediaOp[] = [],
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
  const stepIds = new Set((scenario.steps ?? []).map((step) => step.id));
  for (const step of scenario.steps ?? []) {
    const label = step.phaseLabel?.trim() || step.id;
    if (!step.question?.trim()) {
      issues.push(`${label}: stap zonder vraagtekst.`);
    }
    const hasGood = (step.options ?? []).some(
      (option) => option.quality === 'high' && option.text.trim(),
    );
    if (!hasGood) {
      issues.push(`${label}: geen goed (high) antwoord.`);
    }
    for (const option of step.options ?? []) {
      const next = option.nextStepId?.trim() ?? '';
      if (!next) {
        issues.push(`${label}: ontbrekende volgende stap.`);
        continue;
      }
      if (next !== 'completed' && !stepIds.has(next)) {
        issues.push(`${label}: ontbrekende volgende stap (${next}).`);
      }
    }
    if (!stepHasVideo(scenario, step.id, staged)) {
      issues.push(`${label}: Verpleegkunde-stap zonder video.`);
    }
  }
  issues.push(...validateNursingScenario(scenario));
  return uniqueIssues(issues);
}
