import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { CONCLUSION_NODE_ID, type Scenario } from '../domain/types';
import { emptyNursingScenario } from './emptyScenario';
import { cloneScenario } from './cloneScenario';
import { ScenarioTest } from './ScenarioTest';
import type { NursingScenario, NursingStep } from '../nursing/types';

function nursingWithLines(): NursingScenario {
  const seed = emptyNursingScenario();
  const base = seed.steps[0];
  if (!base) {
    throw new Error('lege stap ontbreekt');
  }
  const make = (
    id: string,
    question: string,
    placeholder: string,
    next: Record<NursingStep['options'][number]['quality'], string>,
  ): NursingStep => ({
    ...base,
    id,
    question,
    stepVideoMode: 'placeholder',
    stepVideoPlaceholder: placeholder,
    options: base.options.map((option) => ({
      ...option,
      id: `${id}-${option.quality}`,
      text: '',
      nextStepId: next[option.quality],
    })) as NursingStep['options'],
  });
  return {
    ...seed,
    meta: { ...seed.meta, startStepId: 's1', title: 'Testcasus' },
    steps: [
      make('s1', 'Vraag een', 'Plaatshouder een', {
        high: 's3',
        partial: 's2',
        inappropriate: 's1',
      }),
      make('s2', 'Vraag twee', 'Plaatshouder twee', {
        high: 'completed',
        partial: 's3',
        inappropriate: 'completed',
      }),
      make('s3', 'Vraag drie', 'Plaatshouder drie', {
        high: 'completed',
        partial: 'completed',
        inappropriate: 'completed',
      }),
    ],
  };
}

function logopedieWithLines(): Scenario {
  const seed = cloneScenario();
  const first = seed.nodes[0];
  const second = seed.nodes[1];
  if (!first || !second) {
    throw new Error('vragen ontbreken');
  }
  return {
    ...seed,
    startNodeId: 'q1',
    nodes: [
      {
        ...first,
        id: 'q1',
        prompt: { ...first.prompt, text: 'Vraag een' },
        options: first.options.map((option) => ({
          ...option,
          nextNodeId:
            option.quality === 'high'
              ? 'q2'
              : option.quality === 'inappropriate'
                ? 'q1'
                : CONCLUSION_NODE_ID,
        })) as Scenario['nodes'][number]['options'],
      },
      {
        ...second,
        id: 'q2',
        prompt: { ...second.prompt, text: 'Vraag twee' },
        options: second.options.map((option) => ({
          ...option,
          nextNodeId: CONCLUSION_NODE_ID,
        })) as Scenario['nodes'][number]['options'],
      },
    ],
  };
}

describe('ScenarioTest', () => {
  it('follows good, partial and a wrong loop, then ends without scores', async () => {
    const user = userEvent.setup();
    const nursing = nursingWithLines();
    const { rerender } = render(
      <ScenarioTest
        key="good"
        module="verpleegkunde"
        scenario={cloneScenario()}
        nursing={nursing}
        onClose={() => undefined}
      />,
    );

    expect(screen.getByTestId('test-question')).toHaveTextContent('Vraag een');
    const startSpot = screen.getByTestId('test-media-stage');
    const startPlaceholder = screen.getByTestId('test-placeholder');
    expect(startSpot).toContainElement(startPlaceholder);
    expect(startPlaceholder.querySelector('p')).toHaveTextContent('Plaatshouder een');

    await user.click(screen.getByTestId('test-option-high'));
    expect(screen.getByTestId('test-question')).toHaveTextContent('Vraag een');
    expect(screen.queryByTestId('screen-scenario-test-results')).not.toBeInTheDocument();
    expect(screen.getByTestId('test-placeholder')).toHaveTextContent('Goed antwoord');
    await user.click(screen.getByTestId('btn-test-continue'));
    expect(screen.getByTestId('test-question')).toHaveTextContent('Vraag drie');
    expect(screen.getByTestId('test-placeholder')).toHaveTextContent('Plaatshouder drie');

    rerender(
      <ScenarioTest
        key="partial"
        module="verpleegkunde"
        scenario={cloneScenario()}
        nursing={nursing}
        onClose={() => undefined}
      />,
    );
    await user.click(screen.getByTestId('test-option-partial'));
    expect(screen.queryByTestId('screen-scenario-test-results')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('btn-test-continue'));
    expect(screen.getByTestId('test-question')).toHaveTextContent('Vraag twee');
    expect(screen.getByTestId('test-placeholder')).toHaveTextContent('Plaatshouder twee');
    await user.click(screen.getByTestId('test-option-high'));
    await user.click(screen.getByTestId('btn-test-continue'));
    expect(screen.getByTestId('test-question')).toHaveTextContent('Vraag drie');

    rerender(
      <ScenarioTest
        key="wrong"
        module="verpleegkunde"
        scenario={cloneScenario()}
        nursing={nursing}
        onClose={() => undefined}
      />,
    );
    await user.click(screen.getByTestId('test-option-inappropriate'));
    expect(screen.getByTestId('test-question')).toHaveTextContent('Vraag een');
    expect(screen.queryByTestId('screen-scenario-test-results')).not.toBeInTheDocument();
    expect(screen.getByTestId('test-placeholder')).toHaveTextContent('Verkeerd antwoord');
    await user.click(screen.getByTestId('btn-test-continue'));
    expect(screen.getByTestId('test-question')).toHaveTextContent('Vraag een');
    expect(screen.getByTestId('test-placeholder')).toHaveTextContent('Plaatshouder een');
    const replay = screen.getByTestId('test-replay');
    expect(replay.tagName).toBe('P');
    expect(replay.closest('button')).toBeNull();
    expect(replay).toHaveTextContent('Deze vraag komt opnieuw.');
    expect(
      screen.queryByRole('button', { name: 'Deze vraag komt opnieuw.' }),
    ).not.toBeInTheDocument();
    expect(
      replay.compareDocumentPosition(screen.getByTestId('test-option-high')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByTestId('test-option-inappropriate')).toBeEnabled();
    await user.click(screen.getByTestId('test-option-inappropriate'));
    await user.click(screen.getByTestId('btn-test-continue'));
    expect(screen.getByTestId('test-question')).toHaveTextContent('Vraag een');
    expect(screen.getByTestId('test-option-high')).toBeEnabled();
    await user.click(screen.getByTestId('test-option-high'));
    await user.click(screen.getByTestId('btn-test-continue'));
    await user.click(screen.getByTestId('test-option-high'));
    await user.click(screen.getByTestId('btn-test-continue'));
    expect(screen.getByTestId('screen-scenario-test-results')).toBeInTheDocument();
    expect(screen.queryByTestId('score-value')).not.toBeInTheDocument();
    expect(screen.queryByText('Competentie scores')).not.toBeInTheDocument();
    expect(screen.queryByText(/ABCDE|SBAR/)).not.toBeInTheDocument();
  });

  it('keeps Erik still and follows a logopedie line without scores', async () => {
    const user = userEvent.setup();
    render(
      <ScenarioTest
        module="logopedie"
        scenario={logopedieWithLines()}
        nursing={emptyNursingScenario()}
        onClose={() => undefined}
      />,
    );
    const avatar = screen.getByTestId('logopedie-avatar');
    expect(avatar).toBeInTheDocument();
    expect(avatar).not.toHaveStyle({ transform: 'scale(1.5)' });
    expect(screen.getByTestId('test-question')).toHaveTextContent('Vraag een');
    const wrongText = screen.getByTestId('test-option-inappropriate').textContent ?? '';
    await user.click(screen.getByTestId('test-option-inappropriate'));
    expect(screen.getByTestId('test-question')).toHaveTextContent('Vraag een');
    expect(screen.queryByTestId('screen-scenario-test-results')).not.toBeInTheDocument();
    expect(screen.getByTestId('test-answer-reaction')).toHaveTextContent(wrongText);
    expect(screen.getByTestId('logopedie-avatar')).not.toHaveStyle({ transform: 'scale(1.5)' });
    await user.click(screen.getByTestId('btn-test-continue'));
    expect(screen.getByTestId('test-question')).toHaveTextContent('Vraag een');
    const replay = screen.getByTestId('test-replay');
    expect(replay.tagName).toBe('P');
    expect(replay.closest('button')).toBeNull();
    expect(replay).toHaveTextContent('Deze vraag komt opnieuw.');
    expect(
      screen.queryByRole('button', { name: 'Deze vraag komt opnieuw.' }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('test-option-inappropriate')).toBeEnabled();
    await user.click(screen.getByTestId('test-option-inappropriate'));
    await user.click(screen.getByTestId('btn-test-continue'));
    expect(screen.getByTestId('test-question')).toHaveTextContent('Vraag een');
    expect(screen.getByTestId('logopedie-avatar')).not.toHaveStyle({ transform: 'scale(1.5)' });
    await user.click(screen.getByTestId('test-option-partial'));
    await user.click(screen.getByTestId('btn-test-continue'));
    expect(screen.getByTestId('test-question')).toHaveTextContent('Vraag twee');
    await user.click(screen.getByTestId('test-option-high'));
    await user.click(screen.getByTestId('btn-test-continue'));
    expect(screen.getByTestId('screen-scenario-test-results')).toBeInTheDocument();
    expect(screen.queryByTestId('score-value')).not.toBeInTheDocument();
  });

  it('ends one step without lines and opens the next question when a good line exists', async () => {
    const user = userEvent.setup();
    const seed = emptyNursingScenario();
    const base = seed.steps[0];
    if (!base) {
      throw new Error('lege stap ontbreekt');
    }
    const alone = {
      ...seed,
      steps: [{ ...base, question: 'Alleen deze vraag' }],
    };
    const { rerender } = render(
      <ScenarioTest
        key="alone"
        module="verpleegkunde"
        scenario={cloneScenario()}
        nursing={alone}
        onClose={() => undefined}
      />,
    );
    await user.click(screen.getByTestId('test-option-inappropriate'));
    expect(screen.getByTestId('test-question')).toHaveTextContent('Alleen deze vraag');
    expect(screen.queryByTestId('screen-scenario-test-results')).not.toBeInTheDocument();
    expect(screen.getByTestId('test-placeholder')).toHaveTextContent('Verkeerd antwoord');
    await user.click(screen.getByTestId('btn-test-continue'));
    expect(screen.getByTestId('screen-scenario-test-results')).toBeInTheDocument();
    expect(screen.queryByTestId('score-value')).not.toBeInTheDocument();
    expect(screen.queryByText('Competentie scores')).not.toBeInTheDocument();

    const second: NursingStep = {
      ...base,
      id: 's2',
      question: 'Volgende vraag',
      options: base.options.map((option) => ({
        ...option,
        id: `s2-${option.quality}`,
        nextStepId: 'completed',
      })) as NursingStep['options'],
    };
    const linked = {
      ...seed,
      meta: { ...seed.meta, startStepId: base.id },
      steps: [
        {
          ...base,
          question: 'Eerste vraag',
          options: base.options.map((option) => ({
            ...option,
            nextStepId: option.quality === 'high' ? 's2' : 'completed',
          })) as NursingStep['options'],
        },
        second,
      ],
    };
    rerender(
      <ScenarioTest
        key="linked"
        module="verpleegkunde"
        scenario={cloneScenario()}
        nursing={linked}
        onClose={() => undefined}
      />,
    );
    await user.click(screen.getByTestId('test-option-high'));
    expect(screen.queryByTestId('screen-scenario-test-results')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('btn-test-continue'));
    expect(screen.getByTestId('test-question')).toHaveTextContent('Volgende vraag');
    expect(screen.queryByTestId('screen-scenario-test-results')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('test-option-partial'));
    expect(screen.queryByTestId('screen-scenario-test-results')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('btn-test-continue'));
    expect(screen.getByTestId('screen-scenario-test-results')).toBeInTheDocument();
    expect(screen.queryByTestId('score-value')).not.toBeInTheDocument();
  });

  it('shows an answer placeholder on the video spot and still repeats a wrong line', async () => {
    const user = userEvent.setup();
    const nursing = nursingWithLines();
    const first = nursing.steps[0];
    if (!first) {
      throw new Error('lege stap ontbreekt');
    }
    first.options = first.options.map((option) => {
      if (option.quality === 'inappropriate') {
        return {
          ...option,
          answerVideoMode: 'placeholder' as const,
          videoPlaceholder: 'Foutfilm nog opnemen',
        };
      }
      if (option.quality === 'high') {
        return {
          ...option,
          answerVideoMode: 'placeholder' as const,
          videoPlaceholder: 'Goede reactie filmen',
        };
      }
      return option;
    }) as NursingStep['options'];

    render(
      <ScenarioTest
        module="verpleegkunde"
        scenario={cloneScenario()}
        nursing={nursing}
        onClose={() => undefined}
      />,
    );

    const spot = screen.getByTestId('test-media-stage');
    expect(spot).toContainElement(screen.getByTestId('test-placeholder'));
    expect(screen.getByTestId('test-placeholder').querySelector('p')).toHaveTextContent(
      'Plaatshouder een',
    );

    await user.click(screen.getByTestId('test-option-inappropriate'));
    expect(screen.getByTestId('test-question')).toHaveTextContent('Vraag een');
    expect(screen.queryByTestId('screen-scenario-test-results')).not.toBeInTheDocument();
    expect(spot).toContainElement(screen.getByTestId('test-placeholder'));
    expect(screen.getByTestId('test-placeholder').querySelector('p')).toHaveTextContent(
      'Foutfilm nog opnemen',
    );
    expect(screen.queryByTestId('test-replay')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('btn-test-continue'));
    expect(screen.getByTestId('test-question')).toHaveTextContent('Vraag een');
    const replay = screen.getByTestId('test-replay');
    expect(replay.tagName).toBe('P');
    expect(replay.closest('button')).toBeNull();
    expect(screen.getByTestId('test-option-inappropriate')).toBeEnabled();
    expect(screen.getByTestId('test-option-inappropriate')).not.toHaveTextContent(
      'Deze vraag komt opnieuw.',
    );

    await user.click(screen.getByTestId('test-option-inappropriate'));
    await user.click(screen.getByTestId('btn-test-continue'));
    expect(screen.getByTestId('test-question')).toHaveTextContent('Vraag een');
    expect(screen.getByTestId('test-option-high')).toBeEnabled();

    await user.click(screen.getByTestId('test-option-high'));
    expect(screen.getByTestId('test-question')).toHaveTextContent('Vraag een');
    expect(screen.getByTestId('test-placeholder').querySelector('p')).toHaveTextContent(
      'Goede reactie filmen',
    );
    await user.click(screen.getByTestId('btn-test-continue'));
    expect(screen.getByTestId('test-question')).toHaveTextContent('Vraag drie');
    expect(screen.getByTestId('test-placeholder').querySelector('p')).toHaveTextContent(
      'Plaatshouder drie',
    );
    expect(screen.queryByTestId('score-value')).not.toBeInTheDocument();
    expect(screen.queryByText('Competentie scores')).not.toBeInTheDocument();
  });
});
