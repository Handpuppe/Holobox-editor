import { CONCLUSION_NODE_ID, type OptionQuality, type Scenario } from '../domain/types';
import type { NursingScenario, NursingStep } from '../nursing/types';
import {
  ANSWER_FOLDER_NAMES,
  ANSWER_VIDEO_QUALITIES,
  optionForQuality,
  optionPrimaryMediaPath,
} from './nursingAnswerMedia';

export const NODE_PORT_COLOR: Record<OptionQuality, string> = {
  high: '#1f9d55',
  partial: '#e0b000',
  inappropriate: '#e56a93',
};

export interface NodeAnswerView {
  quality: OptionQuality;
  title: string;
  scenario: string;
  onderdeel: string;
  showMedia: boolean;
  mediaLabel: 'Video' | 'Placeholder';
  mediaText: string;
  inPort: string;
  outPort: string;
  nextStepId: string | null;
}

export interface NodeQuestionView {
  id: string;
  title: string;
  scenario: string;
  onderdeel: string;
  vraag: string;
  inPort: string;
  answers: NodeAnswerView[];
}

export interface NodeWire {
  from: string;
  to: string;
  quality: OptionQuality;
  removable: boolean;
}

export interface NodeOverviewModel {
  rows: NodeQuestionView[];
  wires: NodeWire[];
}

function round(value: number): string {
  return String(Math.round(value * 10) / 10);
}

function curveBend(x1: number, y1: number, x2: number, y2: number): { bend: number; lift: number } {
  const dx = x2 - x1;
  return {
    bend: Math.max(48, Math.abs(dx) * 0.35),
    lift: Math.max(32, Math.min(84, Math.abs(dx) * 0.18 + Math.abs(y2 - y1) * 0.12)),
  };
}

export function wirePath(x1: number, y1: number, x2: number, y2: number): string {
  const { bend, lift } = curveBend(x1, y1, x2, y2);
  return `M ${round(x1)} ${round(y1)} C ${round(x1 + bend)} ${round(y1 - lift)} ${round(x2 - bend)} ${round(y2 - lift)} ${round(x2)} ${round(y2)}`;
}

export function wireMidpoint(x1: number, y1: number, x2: number, y2: number): { x: number; y: number } {
  const { bend, lift } = curveBend(x1, y1, x2, y2);
  const p1x = x1 + bend;
  const p1y = y1 - lift;
  const p2x = x2 - bend;
  const p2y = y2 - lift;
  return {
    x: 0.125 * x1 + 0.375 * p1x + 0.375 * p2x + 0.125 * x2,
    y: 0.125 * y1 + 0.375 * p1y + 0.375 * p2y + 0.125 * y2,
  };
}

export function parseFlowOutput(port: string): { stepId: string; quality: OptionQuality } | null {
  const match = /^(?:q-out|a-out)-(.+)-(high|partial|inappropriate)$/.exec(port);
  const stepId = match?.[1];
  const quality = match?.[2];
  if (!stepId || (quality !== 'high' && quality !== 'partial' && quality !== 'inappropriate')) {
    return null;
  }
  return { stepId, quality };
}

export function parseQuestionInput(port: string): string | null {
  if (!port.startsWith('q-in-')) {
    return null;
  }
  const stepId = port.slice('q-in-'.length);
  return stepId || null;
}

function videoName(path: string): string {
  const normalized = path.replaceAll('\\', '/');
  return normalized.split('/').pop() || normalized;
}

function isVideoFile(path: string | null): path is string {
  return Boolean(path && /\.(mp4|webm|mov|m4v)$/i.test(path));
}

function answerMedia(
  path: string | null,
  mode: 'video' | 'placeholder' | undefined,
  placeholder: string | undefined,
): { showMedia: boolean; mediaLabel: 'Video' | 'Placeholder'; mediaText: string } {
  if (isVideoFile(path)) {
    return { showMedia: true, mediaLabel: 'Video', mediaText: videoName(path) };
  }
  if (mode === 'placeholder') {
    return { showMedia: true, mediaLabel: 'Placeholder', mediaText: (placeholder ?? '').trim() };
  }
  return { showMedia: true, mediaLabel: 'Video', mediaText: '' };
}

function wiresFor(rows: NodeQuestionView[]): NodeWire[] {
  const ids = new Set(rows.map((row) => row.id));
  const wires: NodeWire[] = [];
  for (const row of rows) {
    for (const answer of row.answers) {
      wires.push({
        from: `q-out-${row.id}-${answer.quality}`,
        to: answer.inPort,
        quality: answer.quality,
        removable: false,
      });
      if (answer.nextStepId && ids.has(answer.nextStepId)) {
        wires.push({
          from: answer.outPort,
          to: `q-in-${answer.nextStepId}`,
          quality: answer.quality,
          removable: true,
        });
      }
    }
  }
  return wires;
}

export function nursingNodeOverview(scenario: NursingScenario): NodeOverviewModel {
  const title = scenario.meta.title.trim();
  const rows: NodeQuestionView[] = scenario.steps.map((step, index) => ({
    id: step.id,
    title: step.stepName?.trim() || `Vraag ${index + 1}`,
    scenario: title,
    onderdeel: step.phaseLabel.trim(),
    vraag: step.question.trim(),
    inPort: `q-in-${step.id}`,
    answers: ANSWER_VIDEO_QUALITIES.flatMap((quality) => {
      const option = optionForQuality(step, quality);
      if (!option) {
        return [];
      }
      const media = answerMedia(
        optionPrimaryMediaPath(scenario, option),
        option.answerVideoMode,
        option.videoPlaceholder,
      );
      const next = option.nextStepId.trim();
      return [
        {
          quality,
          title: ANSWER_FOLDER_NAMES[quality],
          scenario: title,
          onderdeel: step.phaseLabel.trim(),
          showMedia: media.showMedia,
          mediaLabel: media.mediaLabel,
          mediaText: media.mediaText,
          inPort: `a-in-${step.id}-${quality}`,
          outPort: `a-out-${step.id}-${quality}`,
          nextStepId: next && next !== 'completed' ? next : null,
        },
      ];
    }),
  }));
  return { rows, wires: wiresFor(rows) };
}

export function logopedieNodeOverview(scenario: Scenario): NodeOverviewModel {
  const title = scenario.title.trim();
  const rows: NodeQuestionView[] = scenario.nodes.map((node, index) => ({
    id: node.id,
    title: node.phaseLabel.trim() || `Vraag ${index + 1}`,
    scenario: title,
    onderdeel: node.phaseLabel.trim(),
    vraag: node.prompt.text.trim(),
    inPort: `q-in-${node.id}`,
    answers: ANSWER_VIDEO_QUALITIES.flatMap((quality) => {
      const option = node.options.find((item) => item.quality === quality);
      if (!option) {
        return [];
      }
      const next = option.nextNodeId.trim();
      return [
        {
          quality,
          title: ANSWER_FOLDER_NAMES[quality],
          scenario: title,
          onderdeel: node.phaseLabel.trim(),
          showMedia: false,
          mediaLabel: 'Video' as const,
          mediaText: '',
          inPort: `a-in-${node.id}-${quality}`,
          outPort: `a-out-${node.id}-${quality}`,
          nextStepId: next && next !== CONCLUSION_NODE_ID ? next : null,
        },
      ];
    }),
  }));
  return { rows, wires: wiresFor(rows) };
}

function updateNursingNext(
  scenario: NursingScenario,
  stepId: string,
  quality: OptionQuality,
  nextStepId: string,
): NursingScenario {
  let changed = false;
  const steps = scenario.steps.map((step) => {
    if (step.id !== stepId) {
      return step;
    }
    const options = step.options.map((option) => {
      if (option.quality !== quality || option.nextStepId === nextStepId) {
        return option;
      }
      changed = true;
      return { ...option, nextStepId };
    }) as NursingStep['options'];
    return { ...step, options };
  });
  return changed ? { ...scenario, steps } : scenario;
}

export function connectNursingFlow(
  scenario: NursingScenario,
  fromPort: string,
  toPort: string,
): NursingScenario {
  const from = parseFlowOutput(fromPort);
  const targetId = parseQuestionInput(toPort);
  if (!from || !targetId) {
    return scenario;
  }
  const ids = new Set(scenario.steps.map((step) => step.id));
  if (!ids.has(from.stepId) || !ids.has(targetId)) {
    return scenario;
  }
  return updateNursingNext(scenario, from.stepId, from.quality, targetId);
}

export function disconnectNursingFlow(scenario: NursingScenario, fromPort: string): NursingScenario {
  const from = parseFlowOutput(fromPort);
  if (!from) {
    return scenario;
  }
  return updateNursingNext(scenario, from.stepId, from.quality, 'completed');
}

function updateLogopedieNext(
  scenario: Scenario,
  nodeId: string,
  quality: OptionQuality,
  nextNodeId: string,
): Scenario {
  let changed = false;
  const nodes = scenario.nodes.map((node) => {
    if (node.id !== nodeId) {
      return node;
    }
    const options = node.options.map((option) => {
      if (option.quality !== quality || option.nextNodeId === nextNodeId) {
        return option;
      }
      changed = true;
      return { ...option, nextNodeId };
    }) as Scenario['nodes'][number]['options'];
    return { ...node, options };
  });
  return changed ? { ...scenario, nodes } : scenario;
}

export function connectLogopedieFlow(
  scenario: Scenario,
  fromPort: string,
  toPort: string,
): Scenario {
  const from = parseFlowOutput(fromPort);
  const targetId = parseQuestionInput(toPort);
  if (!from || !targetId) {
    return scenario;
  }
  const ids = new Set(scenario.nodes.map((node) => node.id));
  if (!ids.has(from.stepId) || !ids.has(targetId)) {
    return scenario;
  }
  return updateLogopedieNext(scenario, from.stepId, from.quality, targetId);
}

export function disconnectLogopedieFlow(scenario: Scenario, fromPort: string): Scenario {
  const from = parseFlowOutput(fromPort);
  if (!from) {
    return scenario;
  }
  return updateLogopedieNext(scenario, from.stepId, from.quality, CONCLUSION_NODE_ID);
}
