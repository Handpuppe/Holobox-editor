import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NursingScenario, NursingStep } from '../nursing/types';
import { cloneScenario } from './cloneScenario';
import { emptyNursingScenario } from './emptyScenario';
import { NodeOverview } from './NodeOverview';
import { appendNursingStep } from './nursingSteps';
import { assignAnswerVideo, saveAnswerPlaceholder } from './nursingAnswerMedia';
import {
  NODE_ANSWER_FALLBACK_HEIGHT,
  NODE_ANSWER_GAP,
  NODE_ANSWER_WIDTH,
  NODE_CARD_PITCH,
  NODE_FLOW_ANSWER_SHIFT,
  NODE_FLOW_QUESTION_X,
  NODE_FLOW_ROW_GAP,
  NODE_QUESTION_FALLBACK_HEIGHT,
  NODE_QUESTION_WIDTH,
  NODE_ROW_GAP,
  WIRE_NODE_GAP,
  WIRE_RETURN_GAP,
  alignFlowCards,
  connectLogopedieFlow,
  connectNursingFlow,
  disconnectLogopedieFlow,
  disconnectNursingFlow,
  logopedieNodeOverview,
  nursingNodeOverview,
  placeMissingCards,
  sampleWirePath,
  wireMidpoint,
  wirePath,
  type WireRect,
} from './nodeBoard';

describe('node overview model', () => {
  it('reads nursing cards from the form and keeps a linked video off the placeholder text', () => {
    let draft = emptyNursingScenario();
    const stepId = draft.steps[0]!.id;
    draft = {
      ...draft,
      meta: { ...draft.meta, title: 'Opnamecasus' },
      steps: draft.steps.map((step) => ({
        ...step,
        stepName: 'Eerste vraag',
        phaseLabel: 'Ademhaling',
        question: 'Wat zie je?',
      })),
    };
    draft = saveAnswerPlaceholder(draft, stepId, 'partial', 'Nog filmen: de ademhaling.');
    draft = assignAnswerVideo(draft, stepId, 'high', 'verpleegkunde/al-opgenomen.mp4');

    const before = JSON.stringify(draft);
    const model = nursingNodeOverview(draft);

    expect(JSON.stringify(draft)).toBe(before);
    expect(model.rows[0]).toMatchObject({
      title: 'Eerste vraag',
      scenario: 'Opnamecasus',
      onderdeel: 'Ademhaling',
      vraag: 'Wat zie je?',
    });
    expect(model.rows[0]?.answers.map((item) => item.title)).toEqual([
      'Goed antwoord',
      'Deels goed antwoord',
      'Verkeerd antwoord',
    ]);
    expect(model.rows[0]?.answers[0]).toMatchObject({
      mediaLabel: 'Video',
      mediaText: 'al-opgenomen.mp4',
    });
    expect(model.rows[0]?.answers[1]).toMatchObject({
      mediaLabel: 'Placeholder',
      mediaText: 'Nog filmen: de ademhaling.',
    });
    expect(model.wires.filter((wire) => wire.to.startsWith('a-in-'))).toHaveLength(3);
    expect(JSON.stringify(model)).not.toMatch(/ABCDE|SBAR/);
  });

  it('draws a wire only to a next step that already exists', () => {
    const draft = emptyNursingScenario();
    const first = draft.steps[0]!;
    const secondId = 'n-2';
    const second: NursingStep = {
      ...first,
      id: secondId,
      stepName: 'Tweede stap',
      mediaSlotId: 'slot-2',
      options: first.options.map((option) => ({
        ...option,
        id: `${option.id}-b`,
        nextStepId: 'completed',
      })) as NursingStep['options'],
    };
    const steps: NursingStep[] = [
      {
        ...first,
        options: first.options.map((option, index) =>
          index === 0
            ? { ...option, nextStepId: secondId }
            : { ...option, nextStepId: 'completed' },
        ) as NursingStep['options'],
      },
      second,
    ];
    const model = nursingNodeOverview({ ...draft, steps });
    expect(model.rows.map((row) => row.title)).toEqual(['Vraag.1', 'Tweede stap']);
    expect(model.wires.filter((wire) => wire.to === `q-in-${secondId}`)).toEqual([
      {
        from: `a-out-${first.id}-high`,
        to: `q-in-${secondId}`,
        quality: 'high',
        removable: true,
      },
    ]);
  });

  it('good goes forward, wrong returns to the same question, and partial keeps its own line', () => {
    let draft = emptyNursingScenario();
    const firstId = draft.steps[0]!.id;
    draft = {
      ...draft,
      meta: { ...draft.meta, title: 'Opnamecasus' },
      steps: draft.steps.map((step) => ({
        ...step,
        stepName: 'Eerste vraag',
        phaseLabel: 'Ademhaling',
        question: 'Wat zie je?',
      })),
    };
    draft = saveAnswerPlaceholder(draft, firstId, 'partial', 'Nog filmen: de ademhaling.');
    draft = assignAnswerVideo(draft, firstId, 'high', 'verpleegkunde/al-opgenomen.mp4');
    const first = draft.steps[0]!;
    const secondId = 'n-extra-1';
    const second: NursingStep = {
      ...first,
      id: secondId,
      stepName: 'Tweede stap',
      question: 'Wat doe je daarna?',
      mediaSlotId: 'slot-2',
      options: first.options.map((option) => ({
        ...option,
        id: `${secondId}-${option.quality}`,
        nextStepId: 'completed',
      })) as NursingStep['options'],
    };
    draft = { ...draft, steps: [first, second] };

    draft = connectNursingFlow(draft, `a-out-${firstId}-partial`, `q-in-${secondId}`);
    draft = connectNursingFlow(draft, `q-out-${firstId}-high`, `q-in-${secondId}`);
    draft = connectNursingFlow(draft, `q-out-${firstId}-inappropriate`, `q-in-${firstId}`);
    expect(connectNursingFlow(draft, `a-out-${firstId}-high`, `a-in-${secondId}-high`)).toBe(draft);

    const model = nursingNodeOverview(draft);
    const nextWires = model.wires.filter((wire) => wire.removable);
    expect(nextWires).toEqual([
      {
        from: `a-out-${firstId}-high`,
        to: `q-in-${secondId}`,
        quality: 'high',
        removable: true,
      },
      {
        from: `a-out-${firstId}-partial`,
        to: `q-in-${secondId}`,
        quality: 'partial',
        removable: true,
      },
      {
        from: `a-out-${firstId}-inappropriate`,
        to: `q-in-${firstId}`,
        quality: 'inappropriate',
        removable: true,
      },
    ]);
    expect(nextWires.filter((wire) => wire.to === `q-in-${secondId}`)).toHaveLength(2);
    expect(model.rows.map((row) => row.title)).toEqual(['Eerste vraag', 'Tweede stap']);
    expect(model.rows[0]?.answers).toHaveLength(3);
    expect(model.rows[0]?.answers[0]).toMatchObject({
      mediaLabel: 'Video',
      mediaText: 'al-opgenomen.mp4',
    });
    expect(model.rows[0]?.answers[1]).toMatchObject({
      mediaLabel: 'Placeholder',
      mediaText: 'Nog filmen: de ademhaling.',
    });

    const removed = disconnectNursingFlow(draft, `a-out-${firstId}-partial`);
    const removedModel = nursingNodeOverview(removed);
    expect(removedModel.rows[0]?.answers.map((item) => item.quality)).toEqual([
      'high',
      'partial',
      'inappropriate',
    ]);
    expect(removedModel.wires.some((wire) => wire.removable && wire.quality === 'partial')).toBe(
      false,
    );
    expect(removedModel.wires.filter((wire) => wire.removable).map((wire) => wire.quality)).toEqual(
      ['high', 'inappropriate'],
    );

    const restored = connectNursingFlow(removed, `a-out-${firstId}-partial`, `q-in-${secondId}`);
    const reopened = nursingNodeOverview(JSON.parse(JSON.stringify(restored)) as NursingScenario);
    expect(reopened.wires.filter((wire) => wire.removable)).toEqual(nextWires);
  });

  it('keeps the other logopedie lines when wrong returns to the same question', () => {
    const scenario = cloneScenario();
    const first = scenario.nodes[0]!;
    const partialNext = first.options.find((option) => option.quality === 'partial')?.nextNodeId;
    const highNext = first.options.find((option) => option.quality === 'high')?.nextNodeId;
    const connected = connectLogopedieFlow(
      scenario,
      `q-out-${first.id}-inappropriate`,
      `q-in-${first.id}`,
    );
    const wrong = connected.nodes[0]?.options.find((option) => option.quality === 'inappropriate');
    const partial = connected.nodes[0]?.options.find((option) => option.quality === 'partial');
    const high = connected.nodes[0]?.options.find((option) => option.quality === 'high');
    expect(wrong?.nextNodeId).toBe(first.id);
    expect(partial?.nextNodeId).toBe(partialNext);
    expect(high?.nextNodeId).toBe(highNext);

    const model = logopedieNodeOverview(connected);
    expect(model.rows[0]?.answers.every((answer) => !answer.showMedia)).toBe(true);
    expect(
      model.wires.some(
        (wire) => wire.from === `a-out-${first.id}-inappropriate` && wire.to === `q-in-${first.id}`,
      ),
    ).toBe(true);
    expect(
      model.wires.some(
        (wire) => wire.from === `a-out-${first.id}-partial` && wire.to === `q-in-${partialNext}`,
      ),
    ).toBe(true);

    const removed = disconnectLogopedieFlow(connected, `a-out-${first.id}-inappropriate`);
    expect(
      removed.nodes[0]?.options.find((option) => option.quality === 'inappropriate')?.nextNodeId,
    ).toBe('conclusion');
    expect(removed.nodes[0]?.options).toHaveLength(3);
    expect(
      logopedieNodeOverview(removed).wires.some(
        (wire) => wire.removable && wire.from === `a-out-${first.id}-inappropriate`,
      ),
    ).toBe(false);
  });

  it('skips an answer card when that choice is missing', () => {
    const draft = emptyNursingScenario();
    const step = draft.steps[0]!;
    const partial = step.options.find((option) => option.quality === 'partial')!;
    const wrong = step.options.find((option) => option.quality === 'inappropriate')!;
    const model = nursingNodeOverview({
      ...draft,
      steps: [{ ...step, options: [partial, wrong, wrong] }],
    });
    expect(model.rows[0]?.answers.map((item) => item.quality)).toEqual([
      'partial',
      'inappropriate',
    ]);
  });

  it('keeps video and placeholder off the logopedie overview', () => {
    const model = logopedieNodeOverview(cloneScenario());
    expect(model.rows.length).toBeGreaterThan(1);
    expect(model.rows.every((row) => row.answers.every((answer) => !answer.showMedia))).toBe(true);
    expect(model.wires.length).toBeGreaterThan(0);
    expect(model.rows[0]?.title).not.toMatch(/^Node /);
  });

  it('bends every wire so it is not a straight line', () => {
    const path = wirePath(0, 40, 200, 40);
    expect(path).toBe('M 0 40 C 70 4 130 4 200 40');
    expect(wirePath(0, 40, 200, 40, [])).toBe(path);
    expect(path).not.toContain(' L ');
  });

  it('routes a higher or lower wire around the nodes and keeps a gap', () => {
    const cards: WireRect[] = [
      { left: 100, top: 40, right: 400, bottom: 220 },
      { left: 100, top: 280, right: 400, bottom: 460 },
      { left: 100, top: 520, right: 400, bottom: 700 },
    ];
    const middle = cards[1]!;
    const blocked = {
      left: middle.left - WIRE_NODE_GAP,
      top: middle.top - WIRE_NODE_GAP,
      right: middle.right + WIRE_NODE_GAP,
      bottom: middle.bottom + WIRE_NODE_GAP,
    };
    const inside = (rect: WireRect, point: { x: number; y: number }) =>
      point.x > rect.left && point.x < rect.right && point.y > rect.top && point.y < rect.bottom;
    for (const [x1, y1, x2, y2] of [
      [408, 130, 92, 610],
      [408, 610, 92, 130],
    ] as const) {
      const routed = wirePath(x1, y1, x2, y2, cards);
      expect(routed).toMatch(/[CQ] /);
      expect(routed).not.toBe(wirePath(x1, y1, x2, y2));
      const samples = sampleWirePath(x1, y1, x2, y2, cards);
      for (const point of samples) {
        expect(inside(blocked, point)).toBe(false);
        const nearPort =
          Math.hypot(point.x - x1, point.y - y1) < 12 ||
          Math.hypot(point.x - x2, point.y - y2) < 12;
        if (!nearPort) {
          expect(inside(cards[0]!, point) || inside(cards[2]!, point)).toBe(false);
        }
      }
      expect(inside(blocked, wireMidpoint(x1, y1, x2, y2, cards))).toBe(false);
      const limit = WIRE_NODE_GAP + 32;
      for (const point of samples) {
        expect(point.x).toBeGreaterThan(Math.min(cards[0]!.left, x1, x2) - limit);
        expect(point.x).toBeLessThan(Math.max(cards[0]!.right, x1, x2) + limit);
        expect(point.y).toBeGreaterThan(cards[0]!.top - limit);
        expect(point.y).toBeLessThan(cards[2]!.bottom + limit);
      }
    }
  });

  it('keeps a small gap when a node sits on the direct line', () => {
    const blocker: WireRect = { left: 100, top: 40, right: 220, bottom: 160 };
    const start = { x: 40, y: 100 };
    const end = { x: 280, y: 100 };
    const samples = sampleWirePath(start.x, start.y, end.x, end.y, [blocker]);
    const blocked = {
      left: blocker.left - WIRE_NODE_GAP,
      top: blocker.top - WIRE_NODE_GAP,
      right: blocker.right + WIRE_NODE_GAP,
      bottom: blocker.bottom + WIRE_NODE_GAP,
    };
    const inside = (point: { x: number; y: number }) =>
      point.x > blocked.left &&
      point.x < blocked.right &&
      point.y > blocked.top &&
      point.y < blocked.bottom;
    expect(wirePath(start.x, start.y, end.x, end.y, [blocker])).not.toBe(
      wirePath(start.x, start.y, end.x, end.y),
    );
    for (const point of samples) {
      const nearPort =
        Math.hypot(point.x - start.x, point.y - start.y) < 12 ||
        Math.hypot(point.x - end.x, point.y - end.y) < 12;
      if (!nearPort) {
        expect(inside(point)).toBe(false);
      }
      expect(point.y).toBeGreaterThan(blocker.top - WIRE_NODE_GAP - 32);
      expect(point.y).toBeLessThan(blocker.bottom + WIRE_NODE_GAP + 32);
      expect(point.x).toBeGreaterThan(start.x - 32);
      expect(point.x).toBeLessThan(end.x + 32);
    }
  });

  it('leaves the red return line of vraag 1 when vraag 2 moves right', () => {
    const vraag1: WireRect = { left: 160, top: 80, right: 460, bottom: 400 };
    const verkeerd: WireRect = { left: 560, top: 260, right: 820, bottom: 460 };
    const start = { x: verkeerd.right + 8, y: 360 };
    const end = { x: vraag1.left - 8, y: 240 };
    const ownCards = [vraag1, verkeerd];
    const red = wirePath(start.x, start.y, end.x, end.y, ownCards);
    expect(red).not.toBe(wirePath(start.x, start.y, end.x, end.y));
    const samples = sampleWirePath(start.x, start.y, end.x, end.y, ownCards);
    const low = samples.filter((point) => point.y > verkeerd.bottom);
    const spot = low[Math.floor(low.length / 2)] ?? samples[0]!;
    const deelsGoed: WireRect = {
      left: spot.x - 36,
      right: spot.x + 36,
      top: spot.y + WIRE_RETURN_GAP + 2,
      bottom: spot.y + WIRE_RETURN_GAP + 70,
    };
    const goedVraag2: WireRect = { left: 1400, top: 80, right: 1660, bottom: 280 };
    const moved: WireRect = { ...goedVraag2, left: 1800, right: 2060 };
    expect(wirePath(start.x, start.y, end.x, end.y, [...ownCards, goedVraag2, deelsGoed])).toBe(
      red,
    );
    expect(wirePath(start.x, start.y, end.x, end.y, [...ownCards, moved, deelsGoed])).toBe(red);
    const around = sampleWirePath(start.x, start.y, end.x, end.y, ownCards);
    const vraagBody = {
      left: vraag1.left,
      top: vraag1.top,
      right: vraag1.right,
      bottom: vraag1.bottom,
    };
    expect(
      around.some((point) => {
        const nearPort =
          Math.hypot(point.x - start.x, point.y - start.y) < 12 ||
          Math.hypot(point.x - end.x, point.y - end.y) < 12;
        return (
          !nearPort &&
          point.x > vraagBody.left &&
          point.x < vraagBody.right &&
          point.y > vraagBody.top &&
          point.y < vraagBody.bottom
        );
      }),
    ).toBe(false);
    const gapToRect = (rect: WireRect, point: { x: number; y: number }) => {
      const dx = Math.max(rect.left - point.x, 0, point.x - rect.right);
      const dy = Math.max(rect.top - point.y, 0, point.y - rect.bottom);
      return dx === 0 && dy === 0 ? 0 : Math.hypot(dx, dy);
    };
    for (const point of around) {
      const nearPort =
        Math.hypot(point.x - start.x, point.y - start.y) < 28 ||
        Math.hypot(point.x - end.x, point.y - end.y) < 28;
      if (nearPort) {
        continue;
      }
      expect(gapToRect(vraag1, point)).toBeGreaterThanOrEqual(WIRE_RETURN_GAP - 1);
      expect(gapToRect(verkeerd, point)).toBeGreaterThanOrEqual(WIRE_RETURN_GAP - 1);
    }
    expect(WIRE_RETURN_GAP).toBeGreaterThan(WIRE_NODE_GAP);
  });

  it('aligns questions by number and keeps a return line around the cards', () => {
    const added = appendNursingStep(emptyNursingScenario());
    const second = added.scenario.steps[1]!;
    const first = added.scenario.steps[0]!;
    const swapped = {
      ...added.scenario,
      steps: [
        { ...second, stepName: 'Vraag.10' },
        { ...first, stepName: 'Vraag.2' },
      ],
    };
    const rows = nursingNodeOverview(swapped).rows;
    const heights = {
      'a:n-1:high': 300,
      'a:n-1:partial': 280,
      [`a:${second.id}:high`]: 260,
    };
    const placed = alignFlowCards(rows, heights);
    const vraag2 = placed['q:n-1']!;
    const vraag10 = placed[`q:${second.id}`]!;
    expect(vraag2).toEqual({ x: NODE_FLOW_QUESTION_X, y: 0 });
    expect(vraag10.y).toBe(0);
    expect(vraag10.x).toBeGreaterThan(vraag2.x);
    const answerX = vraag2.x + NODE_FLOW_ANSWER_SHIFT;
    const partialY = 300 + NODE_ANSWER_GAP;
    const wrongY = partialY + NODE_ANSWER_FALLBACK_HEIGHT + NODE_ANSWER_GAP;
    expect(placed['a:n-1:high']).toEqual({ x: answerX, y: 0 });
    expect(placed[`a:${second.id}:high`]).toEqual({
      x: vraag10.x + NODE_FLOW_ANSWER_SHIFT,
      y: 0,
    });
    expect(placed['a:n-1:partial']).toEqual({ x: answerX, y: partialY });
    expect(placed[`a:${second.id}:partial`]!.y).toBe(partialY);
    expect(placed['a:n-1:inappropriate']).toEqual({ x: answerX, y: wrongY });
    expect(placed[`a:${second.id}:inappropriate`]!.y).toBe(wrongY);
    expect(vraag10.x - (answerX + NODE_ANSWER_WIDTH)).toBe(NODE_FLOW_ROW_GAP);
    expect(placed[`a:${second.id}:high`]!.x - (vraag10.x + NODE_QUESTION_WIDTH)).toBe(
      NODE_FLOW_ANSWER_SHIFT - NODE_QUESTION_WIDTH,
    );
    expect(answerX - (vraag2.x + NODE_QUESTION_WIDTH)).toBe(
      NODE_FLOW_ANSWER_SHIFT - NODE_QUESTION_WIDTH,
    );

    const rects: WireRect[] = Object.entries(placed).map(([id, point]) => {
      const width = id.startsWith('a:') ? NODE_ANSWER_WIDTH : NODE_QUESTION_WIDTH;
      const height = id.startsWith('a:')
        ? NODE_ANSWER_FALLBACK_HEIGHT
        : NODE_QUESTION_FALLBACK_HEIGHT;
      return { left: point.x, top: point.y, right: point.x + width, bottom: point.y + height };
    });
    const wrong = placed['a:n-1:inappropriate']!;
    const start = {
      x: wrong.x + NODE_ANSWER_WIDTH + 1,
      y: wrong.y + NODE_ANSWER_FALLBACK_HEIGHT / 2,
    };
    const end = {
      x: vraag2.x - 1,
      y: vraag2.y + NODE_QUESTION_FALLBACK_HEIGHT / 2,
    };
    const samples = sampleWirePath(start.x, start.y, end.x, end.y, rects);
    const gapToRect = (rect: WireRect, point: { x: number; y: number }) => {
      const dx = Math.max(rect.left - point.x, 0, point.x - rect.right);
      const dy = Math.max(rect.top - point.y, 0, point.y - rect.bottom);
      return dx === 0 && dy === 0 ? 0 : Math.hypot(dx, dy);
    };
    const vraagRect = rects.find((rect) => rect.left === vraag2.x && rect.top === vraag2.y)!;
    const wrongRect = rects.find((rect) => rect.left === wrong.x && rect.top === wrong.y)!;
    for (const point of samples) {
      const nearPort =
        Math.hypot(point.x - start.x, point.y - start.y) < 28 ||
        Math.hypot(point.x - end.x, point.y - end.y) < 28;
      if (nearPort) {
        continue;
      }
      expect(gapToRect(vraagRect, point)).toBeGreaterThanOrEqual(WIRE_RETURN_GAP - 1);
      expect(gapToRect(wrongRect, point)).toBeGreaterThanOrEqual(WIRE_RETURN_GAP - 1);
    }
  });
});

describe('NodeOverview', () => {
  it('shows read-only cards and dotted curves, then closes without editing', () => {
    const draft = emptyNursingScenario();
    const model = nursingNodeOverview({
      ...draft,
      meta: { ...draft.meta, title: 'Opnamecasus' },
      steps: draft.steps.map((step) => ({
        ...step,
        stepName: 'Eerste vraag',
        question: 'Wat zie je?',
      })),
    });
    const onClose = vi.fn();
    render(<NodeOverview model={model} onClose={onClose} />);

    expect(screen.getByText('Scenario In')).toBeInTheDocument();
    expect(screen.queryByText('Scenario input')).not.toBeInTheDocument();
    expect(screen.queryByText(/^input$/)).not.toBeInTheDocument();
    const overview = screen.getByTestId('node-overview');
    const inputs = overview.querySelectorAll('[data-port-kind="input"]');
    const outputs = overview.querySelectorAll('[data-port-kind="output"]');
    expect(inputs.length).toBeGreaterThan(0);
    expect(outputs.length).toBeGreaterThan(0);
    expect(overview.querySelector('.node-card-question .node-port-word-in')).toHaveTextContent(
      'Scenario In',
    );
    for (const port of overview.querySelectorAll('.node-card-answer .node-port-word-in')) {
      expect(port).toHaveTextContent(/^In$/);
    }
    for (const port of outputs) {
      expect(port.querySelector('.node-port-word-out')).toHaveTextContent('Uit');
    }
    expect(screen.getByTestId(`node-question-${draft.steps[0]!.id}`)).toHaveTextContent(
      'Eerste vraag',
    );
    expect(screen.getByTestId(`node-question-${draft.steps[0]!.id}`)).toHaveTextContent(
      'Opnamecasus',
    );
    expect(screen.getByTestId(`node-question-${draft.steps[0]!.id}`)).toHaveTextContent(
      'Wat zie je?',
    );
    expect(screen.getByTestId(`node-answer-${draft.steps[0]!.id}-high`)).toBeInTheDocument();
    expect(
      screen.getByTestId('node-overview').querySelectorAll('input, textarea, select'),
    ).toHaveLength(0);
    const paths = screen.getByTestId('node-wires').querySelectorAll('path');
    expect(paths.length).toBe(model.wires.length);
    expect(paths[0]).toHaveAttribute('stroke-dasharray', '7 6');
    expect(paths[0]?.getAttribute('d')).toMatch(/C /);
    expect(screen.getByTestId('btn-nodes-back')).toHaveTextContent('Terug naar editor');
    expect(screen.getByTestId('node-overview')).toHaveStyle({
      '--node-row-gap': `${NODE_ROW_GAP}px`,
      '--node-answer-gap': `${NODE_ANSWER_GAP}px`,
      '--node-question-head': '#243044',
      '--node-answer-head': '#6b5200',
      '--node-board-bg': '#141414',
    });
    expect(screen.getByTestId(`node-question-${draft.steps[0]!.id}`)).toHaveClass(
      'node-card-question',
    );
    expect(screen.getByTestId(`node-answer-${draft.steps[0]!.id}-high`)).toHaveClass(
      'node-card-answer',
    );
    expect(NODE_ROW_GAP).toBeGreaterThan(40);
    expect(NODE_ANSWER_GAP).toBeGreaterThan(18);
    expect(NODE_CARD_PITCH).toBeGreaterThan(340);

    screen.getByTestId('btn-nodes-back').click();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('drops a dragged output on Scenario input', () => {
    const draft = emptyNursingScenario();
    const stepId = draft.steps[0]!.id;
    const model = nursingNodeOverview(draft);
    const onConnect = vi.fn();
    render(<NodeOverview model={model} onClose={vi.fn()} onConnect={onConnect} />);
    const from = document.querySelector(`[data-port="q-out-${stepId}-inappropriate"]`);
    const to = document.querySelector(`[data-port="q-in-${stepId}"]`);
    if (!(from instanceof HTMLElement) || !(to instanceof Element)) {
      throw new Error('Poort ontbreekt.');
    }
    const previous = document.elementFromPoint;
    document.elementFromPoint = () => to;
    try {
      fireEvent.pointerDown(from, { clientX: 4, clientY: 4, button: 0 });
      window.dispatchEvent(
        new PointerEvent('pointerup', { clientX: 20, clientY: 20, bubbles: true }),
      );
    } finally {
      document.elementFromPoint = previous;
    }
    expect(onConnect).toHaveBeenCalledWith(`q-out-${stepId}-inappropriate`, `q-in-${stepId}`);
  });

  it('drops a dragged output on the question card itself', () => {
    const draft = emptyNursingScenario();
    const stepId = draft.steps[0]!.id;
    const model = nursingNodeOverview(draft);
    const onConnect = vi.fn();
    render(<NodeOverview model={model} onClose={vi.fn()} onConnect={onConnect} />);
    const from = document.querySelector(`[data-port="q-out-${stepId}-high"]`);
    const card = document.querySelector(`[data-testid="node-question-${stepId}"]`);
    if (!(from instanceof HTMLElement) || !(card instanceof Element)) {
      throw new Error('Vraagkaart ontbreekt.');
    }
    const previous = document.elementFromPoint;
    document.elementFromPoint = () => card;
    try {
      fireEvent.pointerDown(from, { clientX: 4, clientY: 4, button: 0 });
      window.dispatchEvent(
        new PointerEvent('pointerup', { clientX: 40, clientY: 40, bubbles: true }),
      );
    } finally {
      document.elementFromPoint = previous;
    }
    expect(onConnect).toHaveBeenCalledWith(`q-out-${stepId}-high`, `q-in-${stepId}`);
  });

  it('ignores a drop on an answer card', () => {
    const draft = emptyNursingScenario();
    const stepId = draft.steps[0]!.id;
    const model = nursingNodeOverview(draft);
    const onConnect = vi.fn();
    render(<NodeOverview model={model} onClose={vi.fn()} onConnect={onConnect} />);
    const from = document.querySelector(`[data-port="q-out-${stepId}-partial"]`);
    const card = document.querySelector(`[data-testid="node-answer-${stepId}-partial"]`);
    if (!(from instanceof HTMLElement) || !(card instanceof Element)) {
      throw new Error('Antwoordkaart ontbreekt.');
    }
    const previous = document.elementFromPoint;
    document.elementFromPoint = () => card;
    try {
      fireEvent.pointerDown(from, { clientX: 4, clientY: 4, button: 0 });
      window.dispatchEvent(
        new PointerEvent('pointerup', { clientX: 40, clientY: 40, bubbles: true }),
      );
    } finally {
      document.elementFromPoint = previous;
    }
    expect(onConnect).not.toHaveBeenCalled();
  });

  it('moves a card without changing the connected ports', () => {
    const draft = emptyNursingScenario();
    const stepId = draft.steps[0]!.id;
    const model = nursingNodeOverview(draft);
    const onConnect = vi.fn();
    render(<NodeOverview model={model} onClose={vi.fn()} onConnect={onConnect} />);
    const card = screen.getByTestId(`node-question-${stepId}`);
    const wires = [...document.querySelectorAll('[data-wire-from]')].map(
      (wire) => `${wire.getAttribute('data-wire-from')}->${wire.getAttribute('data-wire-to')}`,
    );
    act(() => {
      fireEvent.pointerDown(card, { clientX: 10, clientY: 12, button: 0 });
      window.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 80, clientY: 46, bubbles: true }),
      );
      window.dispatchEvent(
        new PointerEvent('pointerup', { clientX: 80, clientY: 46, bubbles: true }),
      );
    });
    expect(card.style.left).toBe(`${NODE_FLOW_QUESTION_X + 70}px`);
    expect(card.style.top).toBe('34px');
    expect(onConnect).not.toHaveBeenCalled();
    const after = [...document.querySelectorAll('[data-wire-from]')].map(
      (wire) => `${wire.getAttribute('data-wire-from')}->${wire.getAttribute('data-wire-to')}`,
    );
    expect(after).toEqual(wires);
    expect(screen.getByTestId('btn-task-list')).toHaveTextContent('Takenlijst');
  });

  it('keeps delete disabled when only one question is on the board', () => {
    const model = nursingNodeOverview(emptyNursingScenario());
    render(<NodeOverview model={model} onClose={vi.fn()} onDeleteQuestion={vi.fn()} />);
    const barButtons = document.querySelectorAll('.node-overview-bar > button');
    expect(barButtons[0]).toHaveTextContent('Undo');
    expect(barButtons[0]).toBeDisabled();
    fireEvent.click(screen.getByTestId('btn-node-menu-n-1'));
    expect(screen.getByTestId('btn-node-delete-n-1')).toBeDisabled();
  });

  it('shows Leeg on a new question and opens that question', () => {
    const added = appendNursingStep(emptyNursingScenario());
    const model = nursingNodeOverview(added.scenario, new Set([added.step.id]));
    const onCreate = vi.fn();
    render(
      <NodeOverview
        model={model}
        onClose={vi.fn()}
        onCreateQuestion={onCreate}
        renderQuestionWizard={(stepId) => <div data-testid="node-wizard-stub">{stepId}</div>}
      />,
    );
    fireEvent.click(screen.getByTestId('btn-node-new-question'));
    expect(onCreate).toHaveBeenCalledOnce();
    const card = screen.getByTestId(`node-question-${added.step.id}`);
    expect(card).toHaveTextContent('Vraag.2');
    expect(card).toHaveTextContent('Leeg');
    expect(screen.queryByTestId(`node-answer-${added.step.id}-high`)).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId(`btn-node-empty-${added.step.id}`));
    expect(screen.getByTestId('node-wizard-stub')).toHaveTextContent(added.step.id);
    const first = screen.getByTestId('node-question-n-1');
    const nieuw = screen.getByTestId(`node-question-${added.step.id}`);
    expect(first.querySelector('.node-port-word-in')).toHaveTextContent('Scenario In');
    expect(nieuw.querySelector('.node-port-word-in')).toHaveTextContent(/^In$/);
    expect(document.querySelector('.node-port-caption')).not.toBeInTheDocument();
    const firstX = Number.parseFloat(first.style.left);
    const nieuwX = Number.parseFloat(nieuw.style.left);
    expect(nieuwX).toBeGreaterThan(firstX);
    expect(Number.parseFloat(nieuw.style.top)).toBeCloseTo(Number.parseFloat(first.style.top));
  });

  it('places a new question to the right of Vraag.2 and keeps saved cards and lines', () => {
    const saved = {
      'q:n-1': { x: 168, y: 0 },
      'a:n-1:high': { x: 564, y: 0 },
      'a:n-1:partial': { x: 564, y: 346 },
      'a:n-1:inappropriate': { x: 563, y: 733 },
      'q:n-extra-1': { x: 1063, y: 301 },
      'a:n-extra-1:high': { x: 1504, y: 173 },
      'a:n-extra-1:partial': { x: 1491, y: 520 },
      'a:n-extra-1:inappropriate': { x: 1515, y: 838 },
    };
    let draft = appendNursingStep(emptyNursingScenario()).scenario;
    const added = appendNursingStep(draft);
    draft = {
      ...added.scenario,
      steps: added.scenario.steps.map((step) =>
        step.id === 'n-1'
          ? {
              ...step,
              options: step.options.map((option) =>
                option.quality === 'inappropriate' ? { ...option, nextStepId: 'n-1' } : option,
              ) as NursingStep['options'],
            }
          : step,
      ),
    };
    const twoSteps = { ...draft, steps: draft.steps.slice(0, 2) };
    const cardIds = [
      ...Object.keys(saved),
      `q:${added.step.id}`,
      `a:${added.step.id}:high`,
      `a:${added.step.id}:partial`,
      `a:${added.step.id}:inappropriate`,
    ];
    const placed = placeMissingCards(saved, cardIds);
    for (const [id, point] of Object.entries(saved)) {
      expect(placed[id]).toEqual(point);
    }
    const kept = placeMissingCards(placed, cardIds, {
      'q:n-1': 900,
      'a:n-extra-1:inappropriate': 900,
    });
    expect(kept).toEqual(placed);
    const vraag2 = saved['q:n-extra-1']!;
    const lowest = saved['a:n-extra-1:inappropriate']!;
    const rowRight = Math.max(
      vraag2.x + NODE_QUESTION_WIDTH,
      saved['a:n-extra-1:high']!.x + NODE_ANSWER_WIDTH,
      saved['a:n-extra-1:partial']!.x + NODE_ANSWER_WIDTH,
      lowest.x + NODE_ANSWER_WIDTH,
    );
    expect(placed[`q:${added.step.id}`]).toEqual({
      x: rowRight + NODE_FLOW_ROW_GAP,
      y: vraag2.y,
    });
    expect(placed[`q:${added.step.id}`]!.x).toBeGreaterThan(vraag2.x);
    expect(placed[`q:${added.step.id}`]!.y).toBe(vraag2.y);
    expect(placed[`a:${added.step.id}:high`]).toEqual({
      x: placed[`q:${added.step.id}`]!.x + NODE_FLOW_ANSWER_SHIFT,
      y: placed[`q:${added.step.id}`]!.y,
    });
    const answerPitch = NODE_ANSWER_FALLBACK_HEIGHT + NODE_ANSWER_GAP;
    expect(placed[`a:${added.step.id}:partial`]!.y).toBe(
      placed[`a:${added.step.id}:high`]!.y + answerPitch,
    );
    const measured = placeMissingCards(saved, cardIds, {
      'q:n-extra-1': 300,
      'a:n-extra-1:high': 280,
      'a:n-extra-1:partial': 280,
      'a:n-extra-1:inappropriate': 310,
      [`q:${added.step.id}`]: NODE_QUESTION_FALLBACK_HEIGHT,
      [`a:${added.step.id}:high`]: 240,
      [`a:${added.step.id}:partial`]: 240,
    });
    expect(measured[`q:${added.step.id}`]).toEqual(placed[`q:${added.step.id}`]);
    expect(measured[`a:${added.step.id}:partial`]!.y).toBe(
      measured[`a:${added.step.id}:high`]!.y + 240 + NODE_ANSWER_GAP,
    );
    expect(measured['q:n-1']).toEqual(saved['q:n-1']);
    expect(measured['q:n-extra-1']).toEqual(saved['q:n-extra-1']);

    const { rerender } = render(
      <NodeOverview model={nursingNodeOverview(twoSteps)} savedLayout={saved} onClose={vi.fn()} />,
    );
    const redBefore = document
      .querySelector('[data-wire-from="a-out-n-1-inappropriate"]')
      ?.getAttribute('d');
    expect(redBefore).toBeTruthy();
    rerender(
      <NodeOverview model={nursingNodeOverview(draft)} savedLayout={saved} onClose={vi.fn()} />,
    );
    const redAfter = document
      .querySelector('[data-wire-from="a-out-n-1-inappropriate"]')
      ?.getAttribute('d');
    expect(redAfter).toBe(redBefore);
    const readPoint = (testId: string) => {
      const card = screen.getByTestId(testId);
      return {
        x: Number.parseFloat(card.style.left),
        y: Number.parseFloat(card.style.top),
      };
    };
    expect(readPoint('node-question-n-1')).toEqual({ x: 168, y: 0 });
    const shownVraag2 = readPoint('node-question-n-extra-1');
    expect(shownVraag2.x).toBeCloseTo(saved['q:n-extra-1']!.x, 2);
    expect(shownVraag2.y).toBeCloseTo(saved['q:n-extra-1']!.y, 2);
    const shownVerkeerd = readPoint('node-answer-n-1-inappropriate');
    expect(shownVerkeerd.x).toBeCloseTo(saved['a:n-1:inappropriate']!.x, 2);
    expect(shownVerkeerd.y).toBeCloseTo(saved['a:n-1:inappropriate']!.y, 2);
    const nieuw = screen.getByTestId(`node-question-${added.step.id}`);
    const nieuwPunt = readPoint(`node-question-${added.step.id}`);
    expect(nieuwPunt.x).toBeCloseTo(rowRight + NODE_FLOW_ROW_GAP, 2);
    expect(nieuwPunt.y).toBeCloseTo(saved['q:n-extra-1']!.y, 2);
    expect(nieuwPunt.x).toBeGreaterThan(shownVraag2.x);
    expect(
      screen.getByTestId('node-question-n-1').querySelector('.node-port-word-in'),
    ).toHaveTextContent('Scenario In');
    expect(
      screen.getByTestId('node-question-n-extra-1').querySelector('.node-port-word-in'),
    ).toHaveTextContent(/^In$/);
    expect(nieuw.querySelector('.node-port-word-in')).toHaveTextContent(/^In$/);
    expect(document.querySelector('.node-port-caption')).not.toBeInTheDocument();
    const goed = screen.getByTestId(`node-answer-${added.step.id}-high`);
    expect(Number.parseFloat(goed.style.left)).toBeCloseTo(nieuwPunt.x + NODE_FLOW_ANSWER_SHIFT, 2);
    expect(Number.parseFloat(goed.style.top)).toBeCloseTo(nieuwPunt.y, 2);
    const sizer = document.querySelector('.node-canvas-sizer');
    expect(sizer).toBeInstanceOf(HTMLElement);
    if (sizer instanceof HTMLElement) {
      expect(Number.parseFloat(sizer.style.width)).toBeGreaterThan(
        nieuwPunt.x + NODE_QUESTION_WIDTH,
      );
    }
  });

  it('selects two nodes with a background drag and moves them together', () => {
    const added = appendNursingStep(emptyNursingScenario());
    const second = added.step.id;
    const saved = {
      'q:n-1': { x: 168, y: 0 },
      'a:n-1:high': { x: 560, y: 700 },
      'a:n-1:partial': { x: 560, y: 1050 },
      'a:n-1:inappropriate': { x: 560, y: 1400 },
      [`q:${second}`]: { x: 980, y: 0 },
      [`a:${second}:high`]: { x: 1400, y: 700 },
      [`a:${second}:partial`]: { x: 1400, y: 1050 },
      [`a:${second}:inappropriate`]: { x: 1400, y: 1400 },
    };
    const scenario: NursingScenario = {
      ...added.scenario,
      steps: added.scenario.steps.map((step) =>
        step.id === 'n-1'
          ? {
              ...step,
              options: step.options.map((option) =>
                option.quality === 'inappropriate' ? { ...option, nextStepId: 'n-1' } : option,
              ) as NursingStep['options'],
            }
          : step,
      ),
    };
    render(
      <NodeOverview model={nursingNodeOverview(scenario)} savedLayout={saved} onClose={vi.fn()} />,
    );
    const wires = [...document.querySelectorAll('[data-wire-from]')].map(
      (wire) => `${wire.getAttribute('data-wire-from')}->${wire.getAttribute('data-wire-to')}`,
    );
    const canvas = screen.getByTestId('node-canvas');
    act(() => {
      fireEvent.pointerDown(canvas, { clientX: 150, clientY: 20, button: 0 });
      window.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 1200, clientY: 80, bubbles: true }),
      );
    });
    expect(screen.getByTestId('node-marquee')).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(
        new PointerEvent('pointerup', { clientX: 1200, clientY: 80, bubbles: true }),
      );
    });
    expect(screen.queryByTestId('node-marquee')).not.toBeInTheDocument();
    const first = screen.getByTestId('node-question-n-1');
    const next = screen.getByTestId(`node-question-${second}`);
    const answer = screen.getByTestId('node-answer-n-1-high');
    expect(first).toHaveAttribute('data-selected', 'true');
    expect(next).toHaveAttribute('data-selected', 'true');
    expect(answer).toHaveAttribute('data-selected', 'false');
    act(() => {
      fireEvent.pointerDown(first, { clientX: 200, clientY: 40, button: 0 });
      window.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 240, clientY: 70, bubbles: true }),
      );
      window.dispatchEvent(
        new PointerEvent('pointerup', { clientX: 240, clientY: 70, bubbles: true }),
      );
    });
    expect(first.style.left).toBe('208px');
    expect(first.style.top).toBe('30px');
    expect(next.style.left).toBe('1020px');
    expect(next.style.top).toBe('30px');
    expect(answer.style.left).toBe('560px');
    expect(answer.style.top).toBe('700px');
    const after = [...document.querySelectorAll('[data-wire-from]')].map(
      (wire) => `${wire.getAttribute('data-wire-from')}->${wire.getAttribute('data-wire-to')}`,
    );
    expect(after).toEqual(wires);
    expect(
      wires.some((wire) => wire.includes('inappropriate') && wire.endsWith('->q-in-n-1')),
    ).toBe(true);
  });

  it('aligns two questions from the button and remembers that layout', () => {
    const added = appendNursingStep(emptyNursingScenario());
    const second = added.step.id;
    const scenario: NursingScenario = {
      ...added.scenario,
      steps: added.scenario.steps.map((step) =>
        step.id === 'n-1'
          ? {
              ...step,
              options: step.options.map((option) =>
                option.quality === 'inappropriate' ? { ...option, nextStepId: 'n-1' } : option,
              ) as NursingStep['options'],
            }
          : step,
      ),
    };
    const model = nursingNodeOverview(scenario);
    const expected = alignFlowCards(model.rows);
    const messy = {
      'q:n-1': { x: 40, y: 220 },
      'a:n-1:high': { x: 900, y: 40 },
      'a:n-1:partial': { x: 20, y: 640 },
      'a:n-1:inappropriate': { x: 700, y: 900 },
      [`q:${second}`]: { x: 30, y: 1100 },
      [`a:${second}:high`]: { x: 400, y: 1100 },
      [`a:${second}:partial`]: { x: 400, y: 1500 },
      [`a:${second}:inappropriate`]: { x: 480, y: 1900 },
    };
    const onLayoutChange = vi.fn();
    const onUndo = vi.fn();
    const { unmount } = render(
      <NodeOverview
        model={model}
        savedLayout={messy}
        onClose={vi.fn()}
        onLayoutChange={onLayoutChange}
        onUndo={onUndo}
        canUndo
      />,
    );
    const labels = [...document.querySelectorAll('.node-overview-bar > button')].map((button) =>
      button.textContent?.trim(),
    );
    expect(labels.indexOf('Uitlijnen')).toBe(labels.indexOf('Takenlijst') + 1);
    const wires = [...document.querySelectorAll('[data-wire-from]')].map(
      (wire) => `${wire.getAttribute('data-wire-from')}->${wire.getAttribute('data-wire-to')}`,
    );
    expect(screen.getByTestId('btn-node-undo')).toBeEnabled();
    fireEvent.click(screen.getByTestId('btn-node-align'));
    expect(onUndo).not.toHaveBeenCalled();
    expect(screen.getByTestId('btn-node-undo')).toBeEnabled();
    expect(screen.getByTestId('btn-node-edit-n-1')).toBeInTheDocument();
    const readPoint = (testId: string) => {
      const card = screen.getByTestId(testId);
      return {
        x: Number.parseFloat(card.style.left),
        y: Number.parseFloat(card.style.top),
      };
    };
    expect(readPoint('node-question-n-1')).toEqual(expected['q:n-1']);
    expect(readPoint('node-answer-n-1-high')).toEqual(expected['a:n-1:high']);
    expect(readPoint('node-answer-n-1-partial')).toEqual(expected['a:n-1:partial']);
    expect(readPoint('node-answer-n-1-inappropriate')).toEqual(expected['a:n-1:inappropriate']);
    expect(readPoint(`node-question-${second}`)).toEqual(expected[`q:${second}`]);
    expect(readPoint(`node-answer-${second}-high`).y).toBeLessThan(
      readPoint(`node-answer-${second}-partial`).y,
    );
    expect(readPoint(`node-answer-${second}-partial`).y).toBeLessThan(
      readPoint(`node-answer-${second}-inappropriate`).y,
    );
    expect(readPoint(`node-question-${second}`).x).toBeGreaterThan(
      readPoint('node-answer-n-1-high').x,
    );
    expect(readPoint(`node-question-${second}`).y).toBe(0);
    const after = [...document.querySelectorAll('[data-wire-from]')].map(
      (wire) => `${wire.getAttribute('data-wire-from')}->${wire.getAttribute('data-wire-to')}`,
    );
    expect(after).toEqual(wires);
    expect(onLayoutChange).toHaveBeenCalledWith(expected);
    unmount();
    render(<NodeOverview model={model} savedLayout={expected} onClose={vi.fn()} />);
    expect(readPoint('node-question-n-1')).toEqual(expected['q:n-1']);
    expect(readPoint(`node-question-${second}`)).toEqual(expected[`q:${second}`]);
    expect(readPoint('node-answer-n-1-inappropriate')).toEqual(expected['a:n-1:inappropriate']);
  });
});
