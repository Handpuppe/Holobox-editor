import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NursingScenario, NursingStep } from '../nursing/types';
import { cloneScenario } from './cloneScenario';
import { emptyNursingScenario } from './emptyScenario';
import { NodeOverview } from './NodeOverview';
import { assignAnswerVideo, saveAnswerPlaceholder } from './nursingAnswerMedia';
import {
  connectLogopedieFlow,
  connectNursingFlow,
  disconnectLogopedieFlow,
  disconnectNursingFlow,
  logopedieNodeOverview,
  nursingNodeOverview,
  wirePath,
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
    expect(model.rows[0]?.answers[0]).toMatchObject({ mediaLabel: 'Video', mediaText: 'al-opgenomen.mp4' });
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
          index === 0 ? { ...option, nextStepId: secondId } : { ...option, nextStepId: 'completed' },
        ) as NursingStep['options'],
      },
      second,
    ];
    const model = nursingNodeOverview({ ...draft, steps });
    expect(model.rows.map((row) => row.title)).toEqual(['Stap 1', 'Tweede stap']);
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
    expect(removedModel.wires.filter((wire) => wire.removable).map((wire) => wire.quality)).toEqual([
      'high',
      'inappropriate',
    ]);

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
    expect(model.rows[0]?.answers.map((item) => item.quality)).toEqual(['partial', 'inappropriate']);
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
    expect(path).not.toContain(' L ');
  });
});

describe('NodeOverview', () => {
  it('shows read-only cards and dotted curves, then closes without editing', () => {
    const draft = emptyNursingScenario();
    const model = nursingNodeOverview({
      ...draft,
      meta: { ...draft.meta, title: 'Opnamecasus' },
      steps: draft.steps.map((step) => ({ ...step, stepName: 'Eerste vraag', question: 'Wat zie je?' })),
    });
    const onClose = vi.fn();
    render(<NodeOverview model={model} onClose={onClose} />);

    expect(screen.getByText('Scenario input')).toBeInTheDocument();
    expect(screen.getByTestId(`node-question-${draft.steps[0]!.id}`)).toHaveTextContent('Eerste vraag');
    expect(screen.getByTestId(`node-question-${draft.steps[0]!.id}`)).toHaveTextContent('Opnamecasus');
    expect(screen.getByTestId(`node-question-${draft.steps[0]!.id}`)).toHaveTextContent('Wat zie je?');
    expect(screen.getByTestId(`node-answer-${draft.steps[0]!.id}-high`)).toBeInTheDocument();
    expect(screen.getByTestId('node-overview').querySelectorAll('input, textarea, select')).toHaveLength(0);
    const paths = screen.getByTestId('node-wires').querySelectorAll('path');
    expect(paths.length).toBe(model.wires.length);
    expect(paths[0]).toHaveAttribute('stroke-dasharray', '7 6');
    expect(paths[0]?.getAttribute('d')).toMatch(/C /);

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
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: 20, clientY: 20, bubbles: true }));
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
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: 40, clientY: 40, bubbles: true }));
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
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: 40, clientY: 40, bubbles: true }));
    } finally {
      document.elementFromPoint = previous;
    }
    expect(onConnect).not.toHaveBeenCalled();
  });
});
