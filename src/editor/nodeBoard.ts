import {
  CONCLUSION_NODE_ID,
  type NodeLayout,
  type OptionQuality,
  type Scenario,
} from '../domain/types';
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

/** Ruimte tussen gestapelde vraagnodes, groter dan de oude 40px. */
export const NODE_ROW_GAP = 104;
/** Ruimte tussen antwoordnodes onder elkaar, groter dan de oude 18px. */
export const NODE_ANSWER_GAP = 56;
/** Verticale stap voor een node die onder een andere wordt gezet. */
export const NODE_CARD_PITCH = 420;
/** Linkerkant van de eerste vraag in de flow, gelijk aan de rij-padding. */
export const NODE_FLOW_QUESTION_X = 168;
/** Vraagbreedte 300 plus het gat van 96 naar de antwoordkolom. */
export const NODE_FLOW_ANSWER_SHIFT = 396;
/** Breedte van een vraagkaart en een antwoordkaart op het bord. */
export const NODE_QUESTION_WIDTH = 300;
export const NODE_ANSWER_WIDTH = 250;
/** Ruimte tussen twee vragen die naast elkaar op de x-as staan. */
export const NODE_FLOW_ROW_GAP = 120;
/** Geschatte hoogte als de kaart nog niet gemeten is. */
export const NODE_QUESTION_FALLBACK_HEIGHT = 320;
export const NODE_ANSWER_FALLBACK_HEIGHT = 292;

function cardStepId(id: string): string {
  if (id.startsWith('q:')) {
    return id.slice(2);
  }
  if (!id.startsWith('a:')) {
    return '';
  }
  const rest = id.slice(2);
  const mark = rest.lastIndexOf(':');
  return mark > 0 ? rest.slice(0, mark) : '';
}

function cardHeight(id: string, heights: Readonly<Record<string, number>>): number {
  const measured = heights[id];
  if (typeof measured === 'number' && Number.isFinite(measured) && measured >= 2) {
    return measured;
  }
  return id.startsWith('a:') ? NODE_ANSWER_FALLBACK_HEIGHT : NODE_QUESTION_FALLBACK_HEIGHT;
}

function cardWidth(id: string): number {
  return id.startsWith('a:') ? NODE_ANSWER_WIDTH : NODE_QUESTION_WIDTH;
}

function rowRightEdge(row: { questionId: string; answerIds: string[] }, cards: NodeLayout): number {
  let right = Number.NEGATIVE_INFINITY;
  const question = cards[row.questionId];
  if (question) {
    right = question.x + cardWidth(row.questionId);
  }
  for (const id of row.answerIds) {
    const point = cards[id];
    if (!point) {
      continue;
    }
    right = Math.max(right, point.x + cardWidth(id));
  }
  return right;
}

/**
 * Zet alleen kaarten zonder opgeslagen punt. Bestaande punten blijven staan.
 * Een nieuwe vraag komt rechts van de vorige, op dezelfde y.
 */
export function placeMissingCards(
  existing: NodeLayout,
  cardIds: string[],
  heights: Readonly<Record<string, number>> = {},
): NodeLayout {
  const cards: NodeLayout = {};
  for (const id of cardIds) {
    const point = existing[id];
    if (!point) {
      continue;
    }
    cards[id] = { x: point.x, y: point.y };
  }
  const rows: { stepId: string; questionId: string; answerIds: string[] }[] = [];
  const byStep = new Map<string, (typeof rows)[number]>();
  for (const id of cardIds) {
    const stepId = cardStepId(id);
    if (!stepId) {
      continue;
    }
    let row = byStep.get(stepId);
    if (!row) {
      row = { stepId, questionId: `q:${stepId}`, answerIds: [] };
      byStep.set(stepId, row);
      rows.push(row);
    }
    if (id.startsWith('a:')) {
      row.answerIds.push(id);
    }
  }
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row) {
      continue;
    }
    if (!cards[row.questionId]) {
      const previous = rows
        .slice(0, index)
        .reverse()
        .find((item) => cards[item.questionId]);
      if (!previous) {
        cards[row.questionId] = { x: NODE_FLOW_QUESTION_X, y: 0 };
      } else {
        const origin = cards[previous.questionId];
        if (!origin) {
          continue;
        }
        const right = rowRightEdge(previous, cards);
        const edge = Number.isFinite(right) ? right : origin.x + cardWidth(previous.questionId);
        cards[row.questionId] = { x: edge + NODE_FLOW_ROW_GAP, y: origin.y };
      }
    }
    const question = cards[row.questionId];
    if (!question) {
      continue;
    }
    let cursor = question.y;
    for (const id of row.answerIds) {
      const point = cards[id];
      if (!point) {
        continue;
      }
      cursor = Math.max(cursor, point.y + cardHeight(id, heights) + NODE_ANSWER_GAP);
    }
    for (const id of row.answerIds) {
      if (cards[id]) {
        continue;
      }
      cards[id] = { x: question.x + NODE_FLOW_ANSWER_SHIFT, y: cursor };
      cursor += cardHeight(id, heights) + NODE_ANSWER_GAP;
    }
  }
  return cards;
}

function questionNumber(title: string): number | null {
  const match = /^\s*vraag\s*\.?\s*(\d+)/i.exec(title);
  if (!match?.[1]) {
    return null;
  }
  const value = Number(match[1]);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

/**
 * Zet alle vragen op één rij, Vraag.1 links en elke volgende vraag rechts daarvan.
 * Elke soort kaart deelt één y. De horizontale stap is overal gelijk.
 */
export function alignFlowCards(
  rows: readonly Pick<NodeQuestionView, 'id' | 'title' | 'empty' | 'answers'>[],
  heights: Readonly<Record<string, number>> = {},
): NodeLayout {
  const ordered = rows
    .map((row, index) => ({ row, index, number: questionNumber(row.title) }))
    .sort((left, right) => {
      const leftNumber = left.number ?? Number.POSITIVE_INFINITY;
      const rightNumber = right.number ?? Number.POSITIVE_INFINITY;
      if (leftNumber !== rightNumber) {
        return leftNumber - rightNumber;
      }
      return left.index - right.index;
    });
  const bandY: Partial<Record<(typeof ANSWER_VIDEO_QUALITIES)[number], number>> = {};
  let cursor = 0;
  for (const quality of ANSWER_VIDEO_QUALITIES) {
    let maxHeight = 0;
    let present = false;
    for (const { row } of ordered) {
      if (row.empty || !row.answers.some((answer) => answer.quality === quality)) {
        continue;
      }
      present = true;
      maxHeight = Math.max(maxHeight, cardHeight(`a:${row.id}:${quality}`, heights));
    }
    if (!present) {
      continue;
    }
    bandY[quality] = cursor;
    cursor += Math.ceil(maxHeight) + NODE_ANSWER_GAP;
  }
  const cards: NodeLayout = {};
  let x = NODE_FLOW_QUESTION_X;
  const columnStep = NODE_FLOW_ANSWER_SHIFT + NODE_ANSWER_WIDTH + NODE_FLOW_ROW_GAP;
  for (const { row } of ordered) {
    cards[`q:${row.id}`] = { x, y: 0 };
    const answers = row.empty
      ? []
      : ANSWER_VIDEO_QUALITIES.filter((quality) =>
          row.answers.some((answer) => answer.quality === quality),
        );
    const answerX = x + NODE_FLOW_ANSWER_SHIFT;
    for (const quality of answers) {
      cards[`a:${row.id}:${quality}`] = { x: answerX, y: bandY[quality] ?? 0 };
    }
    x += answers.length > 0 ? columnStep : NODE_QUESTION_WIDTH + NODE_FLOW_ROW_GAP;
  }
  return cards;
}

/** Kleine ruimte tussen een lijn en een node waar de lijn niet op aansluit. */
export const WIRE_NODE_GAP = 8;
/** Extra ruimte voor een lijn die terugloopt naar een beginknoop. */
export const WIRE_RETURN_GAP = 20;
/** Afronding van een hoek. Klein, zodat de lijn niet van de node weg springt. */
const WIRE_FILLET = 6;
/** Stap waarmee een geblokkeerde baan een stukje opschuift. */
const WIRE_LANE_STEP = 4;
/** Verste extra afstand. Geen wijde boog om het hele bord. */
const WIRE_LANE_LIMIT = 24;

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
  /** Nog niet afgerond in Node Modus. Dezelfde stap, alleen de kaart toont Leeg. */
  empty?: boolean;
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

export interface WireRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface WirePoint {
  x: number;
  y: number;
}

interface WireSegment {
  kind: 'L' | 'Q';
  from: WirePoint;
  to: WirePoint;
  control?: WirePoint;
}

function curveBend(x1: number, y1: number, x2: number, y2: number): { bend: number; lift: number } {
  const dx = x2 - x1;
  return {
    bend: Math.max(48, Math.abs(dx) * 0.35),
    lift: Math.max(32, Math.min(84, Math.abs(dx) * 0.18 + Math.abs(y2 - y1) * 0.12)),
  };
}

function pointDistance(left: WirePoint, right: WirePoint): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function inflateRect(rect: WireRect, gap: number): WireRect {
  return {
    left: rect.left - gap,
    top: rect.top - gap,
    right: rect.right + gap,
    bottom: rect.bottom + gap,
  };
}

function pointInside(rect: WireRect, point: WirePoint): boolean {
  return point.x > rect.left && point.x < rect.right && point.y > rect.top && point.y < rect.bottom;
}

function portRect(point: WirePoint, rects: readonly WireRect[]): WireRect | null {
  let best: WireRect | null = null;
  let bestDistance = Infinity;
  for (const rect of rects) {
    const nearestX = Math.max(rect.left, Math.min(point.x, rect.right));
    const nearestY = Math.max(rect.top, Math.min(point.y, rect.bottom));
    const gap = Math.hypot(point.x - nearestX, point.y - nearestY);
    if (gap < bestDistance) {
      bestDistance = gap;
      best = rect;
    }
  }
  if (!best || bestDistance > 24) {
    return null;
  }
  return best;
}

function pointBlocked(
  point: WirePoint,
  rects: readonly WireRect[],
  start: WirePoint,
  end: WirePoint,
): boolean {
  if (pointDistance(point, start) < 10 || pointDistance(point, end) < 10) {
    return false;
  }
  const source = portRect(start, rects);
  const target = portRect(end, rects);
  for (const rect of rects) {
    const gap = rect === source || rect === target ? 0 : WIRE_NODE_GAP;
    if (pointInside(inflateRect(rect, gap), point)) {
      return true;
    }
  }
  return false;
}

function samplesBlocked(
  samples: readonly WirePoint[],
  rects: readonly WireRect[],
  start: WirePoint,
  end: WirePoint,
): boolean {
  return samples.some((point) => pointBlocked(point, rects, start, end));
}

function cubicPoint(
  start: WirePoint,
  control1: WirePoint,
  control2: WirePoint,
  end: WirePoint,
  t: number,
): WirePoint {
  const rest = 1 - t;
  return {
    x:
      rest * rest * rest * start.x +
      3 * rest * rest * t * control1.x +
      3 * rest * t * t * control2.x +
      t * t * t * end.x,
    y:
      rest * rest * rest * start.y +
      3 * rest * rest * t * control1.y +
      3 * rest * t * t * control2.y +
      t * t * t * end.y,
  };
}

function directControls(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): { control1: WirePoint; control2: WirePoint } {
  const { bend, lift } = curveBend(x1, y1, x2, y2);
  return {
    control1: { x: x1 + bend, y: y1 - lift },
    control2: { x: x2 - bend, y: y2 - lift },
  };
}

function directPath(x1: number, y1: number, x2: number, y2: number): string {
  const { control1, control2 } = directControls(x1, y1, x2, y2);
  return `M ${round(x1)} ${round(y1)} C ${round(control1.x)} ${round(control1.y)} ${round(control2.x)} ${round(control2.y)} ${round(x2)} ${round(y2)}`;
}

function directMidpoint(x1: number, y1: number, x2: number, y2: number): WirePoint {
  const { bend, lift } = curveBend(x1, y1, x2, y2);
  const control1X = x1 + bend;
  const control1Y = y1 - lift;
  const control2X = x2 - bend;
  const control2Y = y2 - lift;
  return {
    x: 0.125 * x1 + 0.375 * control1X + 0.375 * control2X + 0.125 * x2,
    y: 0.125 * y1 + 0.375 * control1Y + 0.375 * control2Y + 0.125 * y2,
  };
}

function directSamples(x1: number, y1: number, x2: number, y2: number): WirePoint[] {
  const { control1, control2 } = directControls(x1, y1, x2, y2);
  const start = { x: x1, y: y1 };
  const end = { x: x2, y: y2 };
  const samples: WirePoint[] = [];
  for (let step = 0; step <= 48; step += 1) {
    samples.push(cubicPoint(start, control1, control2, end, step / 48));
  }
  return samples;
}

function filletSegments(points: readonly WirePoint[], radius: number): WireSegment[] {
  const compact: WirePoint[] = [];
  for (const point of points) {
    const previous = compact[compact.length - 1];
    if (!previous || pointDistance(previous, point) > 0.5) {
      compact.push(point);
    }
  }
  if (compact.length < 2) {
    return [];
  }
  const segments: WireSegment[] = [];
  let cursor = compact[0]!;
  for (let index = 1; index < compact.length - 1; index += 1) {
    const previous = compact[index - 1]!;
    const current = compact[index]!;
    const next = compact[index + 1]!;
    const lengthIn = pointDistance(previous, current);
    const lengthOut = pointDistance(current, next);
    const used = Math.min(radius, lengthIn / 2, lengthOut / 2);
    if (used < 1) {
      segments.push({ kind: 'L', from: cursor, to: current });
      cursor = current;
      continue;
    }
    const before = {
      x: current.x + ((previous.x - current.x) / lengthIn) * used,
      y: current.y + ((previous.y - current.y) / lengthIn) * used,
    };
    const after = {
      x: current.x + ((next.x - current.x) / lengthOut) * used,
      y: current.y + ((next.y - current.y) / lengthOut) * used,
    };
    if (pointDistance(cursor, before) > 0.5) {
      segments.push({ kind: 'L', from: cursor, to: before });
    }
    segments.push({ kind: 'Q', from: before, to: after, control: current });
    cursor = after;
  }
  const last = compact[compact.length - 1]!;
  if (pointDistance(cursor, last) > 0.5) {
    segments.push({ kind: 'L', from: cursor, to: last });
  }
  return segments;
}

function sampleSegment(segment: WireSegment): WirePoint[] {
  const samples: WirePoint[] = [];
  if (segment.kind === 'L') {
    const steps = Math.max(2, Math.ceil(pointDistance(segment.from, segment.to) / 6));
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      samples.push({
        x: segment.from.x + (segment.to.x - segment.from.x) * t,
        y: segment.from.y + (segment.to.y - segment.from.y) * t,
      });
    }
    return samples;
  }
  const control = segment.control ?? segment.to;
  for (let step = 0; step <= 12; step += 1) {
    const t = step / 12;
    const rest = 1 - t;
    samples.push({
      x: rest * rest * segment.from.x + 2 * rest * t * control.x + t * t * segment.to.x,
      y: rest * rest * segment.from.y + 2 * rest * t * control.y + t * t * segment.to.y,
    });
  }
  return samples;
}

function segmentsToPath(segments: readonly WireSegment[]): string {
  const first = segments[0];
  if (!first) {
    return '';
  }
  let path = `M ${round(first.from.x)} ${round(first.from.y)}`;
  for (const segment of segments) {
    if (segment.kind === 'L') {
      path += ` L ${round(segment.to.x)} ${round(segment.to.y)}`;
      continue;
    }
    const control = segment.control ?? segment.to;
    path += ` Q ${round(control.x)} ${round(control.y)} ${round(segment.to.x)} ${round(segment.to.y)}`;
  }
  return path;
}

function midpointOf(samples: readonly WirePoint[]): WirePoint {
  const first = samples[0];
  if (!first) {
    return { x: 0, y: 0 };
  }
  let total = 0;
  for (let index = 1; index < samples.length; index += 1) {
    total += pointDistance(samples[index - 1]!, samples[index]!);
  }
  let walked = 0;
  const half = total / 2;
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1]!;
    const current = samples[index]!;
    const span = pointDistance(previous, current);
    if (walked + span >= half) {
      const t = span === 0 ? 0 : (half - walked) / span;
      return {
        x: previous.x + (current.x - previous.x) * t,
        y: previous.y + (current.y - previous.y) * t,
      };
    }
    walked += span;
  }
  return samples[samples.length - 1] ?? first;
}

function channelSamples(x: number, fromY: number, toY: number): WirePoint[] {
  const top = Math.min(fromY, toY);
  const bottom = Math.max(fromY, toY);
  const steps = Math.max(2, Math.ceil((bottom - top) / 6));
  const samples: WirePoint[] = [];
  for (let step = 0; step <= steps; step += 1) {
    samples.push({ x, y: top + ((bottom - top) * step) / steps });
  }
  return samples;
}

function clearChannelX(
  x: number,
  fromY: number,
  toY: number,
  rects: readonly WireRect[],
  start: WirePoint,
  end: WirePoint,
  direction: 1 | -1,
  gap: number,
): number {
  const source = portRect(start, rects);
  const target = portRect(end, rects);
  let cursor = x;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    if (!samplesBlocked(channelSamples(cursor, fromY, toY), rects, start, end)) {
      return cursor;
    }
    let next = cursor + direction * WIRE_LANE_STEP;
    for (const rect of rects) {
      const pad = rect === source || rect === target ? 0 : gap;
      const zone = inflateRect(rect, pad);
      if (cursor > zone.left && cursor < zone.right) {
        const edge = direction > 0 ? zone.right + 1 : zone.left - 1;
        next = direction > 0 ? Math.max(next, edge) : Math.min(next, edge);
      }
    }
    if (next === cursor) {
      next = cursor + direction * WIRE_LANE_STEP;
    }
    cursor = next;
  }
  return cursor;
}

function lanePoints(
  start: WirePoint,
  end: WirePoint,
  exitX: number,
  entryX: number,
  laneY: number,
): WirePoint[] {
  return [
    start,
    { x: exitX, y: start.y },
    { x: exitX, y: laneY },
    { x: entryX, y: laneY },
    { x: entryX, y: end.y },
    end,
  ];
}

function routeLength(points: readonly WirePoint[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += pointDistance(points[index - 1]!, points[index]!);
  }
  return total;
}

function rectHitsSamples(
  rect: WireRect,
  samples: readonly WirePoint[],
  start: WirePoint,
  end: WirePoint,
  source: WireRect | null,
  target: WireRect | null,
): boolean {
  const gap = rect === source || rect === target ? 0 : WIRE_NODE_GAP;
  const zone = inflateRect(rect, gap);
  return samples.some(
    (point) =>
      pointDistance(point, start) >= 10 &&
      pointDistance(point, end) >= 10 &&
      pointInside(zone, point),
  );
}

function routeSamples(points: readonly WirePoint[]): WirePoint[] {
  return filletSegments(points, WIRE_FILLET).flatMap((segment) => sampleSegment(segment));
}

/** Baan om alleen de kaarten die deze lijn zelf raakt. Andere kaarten doen niet mee. */
function laneRoute(
  start: WirePoint,
  end: WirePoint,
  rects: readonly WireRect[],
  gap: number,
): WirePoint[] {
  const source = portRect(start, rects);
  const target = portRect(end, rects);
  const localExit = source
    ? start.x >= (source.left + source.right) / 2
      ? source.right + gap
      : source.left - gap
    : start.x + gap * 2;
  const localEntry = target
    ? end.x <= (target.left + target.right) / 2
      ? target.left - gap
      : target.right + gap
    : end.x - gap * 2;
  const top = Math.min(...rects.map((rect) => rect.top), start.y, end.y);
  const bottom = Math.max(...rects.map((rect) => rect.bottom), start.y, end.y);
  const above = top - gap;
  const below = bottom + gap;
  const spanTop = Math.min(above - WIRE_LANE_LIMIT, start.y, end.y);
  const spanBottom = Math.max(below + WIRE_LANE_LIMIT, start.y, end.y);
  const exitX = clearChannelX(
    localExit,
    spanTop,
    spanBottom,
    rects,
    start,
    end,
    localExit >= start.x ? 1 : -1,
    gap,
  );
  const entryX = clearChannelX(
    localEntry,
    spanTop,
    spanBottom,
    rects,
    start,
    end,
    localEntry <= end.x ? -1 : 1,
    gap,
  );
  let best: WirePoint[] | null = null;
  let bestLength = Infinity;
  for (let extra = 0; extra <= WIRE_LANE_LIMIT; extra += WIRE_LANE_STEP) {
    let found = false;
    for (const lane of [above - extra, below + extra]) {
      const points = lanePoints(start, end, exitX, entryX, lane);
      if (samplesBlocked(routeSamples(points), rects, start, end)) {
        continue;
      }
      found = true;
      const length = routeLength(points);
      if (length < bestLength) {
        bestLength = length;
        best = points;
      }
    }
    if (found && best) {
      return best;
    }
  }
  return best ?? lanePoints(start, end, exitX, entryX, above - WIRE_LANE_LIMIT);
}

function routeAround(start: WirePoint, end: WirePoint, rects: readonly WireRect[]): WirePoint[] {
  const source = portRect(start, rects);
  const target = portRect(end, rects);
  const direct = directSamples(start.x, start.y, end.x, end.y);
  const involved: WireRect[] = [];
  for (const rect of rects) {
    if (
      rect === source ||
      rect === target ||
      rectHitsSamples(rect, direct, start, end, source, target)
    ) {
      involved.push(rect);
    }
  }
  if (involved.length === 0) {
    involved.push(...rects);
  }
  const gap = end.x < start.x ? WIRE_RETURN_GAP : WIRE_NODE_GAP;
  let points = laneRoute(start, end, involved, gap);
  for (let pass = 0; pass < rects.length; pass += 1) {
    const samples = routeSamples(points);
    const extra = rects.filter(
      (rect) =>
        !involved.includes(rect) && rectHitsSamples(rect, samples, start, end, source, target),
    );
    if (extra.length === 0) {
      return points;
    }
    involved.push(...extra);
    points = laneRoute(start, end, involved, gap);
  }
  return points;
}

interface WirePlan {
  d: string;
  midpoint: WirePoint;
  samples: WirePoint[];
}

function planWire(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  obstacles: readonly WireRect[],
): WirePlan {
  const start = { x: x1, y: y1 };
  const end = { x: x2, y: y2 };
  const straight = directSamples(x1, y1, x2, y2);
  if (obstacles.length === 0 || !samplesBlocked(straight, obstacles, start, end)) {
    return {
      d: directPath(x1, y1, x2, y2),
      midpoint: directMidpoint(x1, y1, x2, y2),
      samples: straight,
    };
  }
  const points = routeAround(start, end, obstacles);
  const segments = filletSegments(points, WIRE_FILLET);
  const samples = segments.flatMap((segment) => sampleSegment(segment));
  return {
    d: segmentsToPath(segments),
    midpoint: midpointOf(samples),
    samples,
  };
}

export function wirePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  obstacles: readonly WireRect[] = [],
): string {
  return planWire(x1, y1, x2, y2, obstacles).d;
}

export function wireMidpoint(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  obstacles: readonly WireRect[] = [],
): { x: number; y: number } {
  return planWire(x1, y1, x2, y2, obstacles).midpoint;
}

export function sampleWirePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  obstacles: readonly WireRect[] = [],
): Array<{ x: number; y: number }> {
  return planWire(x1, y1, x2, y2, obstacles).samples;
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

export function nursingNodeOverview(
  scenario: NursingScenario,
  draftStepIds: ReadonlySet<string> = new Set(),
): NodeOverviewModel {
  const title = scenario.meta.title.trim();
  const rows: NodeQuestionView[] = scenario.steps.map((step, index) => ({
    id: step.id,
    title: step.stepName?.trim() || `Vraag ${index + 1}`,
    scenario: title,
    onderdeel: step.phaseLabel.trim(),
    vraag: step.question.trim(),
    inPort: `q-in-${step.id}`,
    empty: draftStepIds.has(step.id),
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

export function disconnectNursingFlow(
  scenario: NursingScenario,
  fromPort: string,
): NursingScenario {
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
