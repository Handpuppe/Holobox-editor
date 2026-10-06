import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { NursingScenario } from '../nursing/types';
import { cloneNursingScenario } from './cloneNursing';
import { NursingAnswerVideos } from './NursingAnswerVideos';
import { optionForQuality, optionPrimaryMediaPath } from './nursingAnswerMedia';
import { questionVideoRelative, resolvedQuestionFolder } from './questionFolder';
import type { StagedNursingMediaOp } from './nursingMedia';

function Harness({
  initial,
  onStage,
}: {
  initial: NursingScenario;
  onStage: (op: StagedNursingMediaOp) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const step = draft.steps[0]!;
  return (
    <NursingAnswerVideos
      draft={draft}
      step={step}
      staged={[]}
      catalog={[]}
      onChange={setDraft}
      onStage={onStage}
    />
  );
}

describe('NursingAnswerVideos', () => {
  it('shows three answer places and saves placeholder text without a video file', async () => {
    const user = userEvent.setup();
    const onStage = vi.fn();
    render(<Harness initial={cloneNursingScenario()} onStage={onStage} />);

    expect(screen.getByText('Bij goed antwoord play video')).toBeInTheDocument();
    expect(screen.getByText('Bij deels goed antwoord play video')).toBeInTheDocument();
    expect(screen.getByText('Bij verkeerd antwoord play video')).toBeInTheDocument();

    await user.click(screen.getByTestId('nursing-answer-mode-placeholder-partial'));
    fireEvent.change(screen.getByTestId('nursing-answer-placeholder-partial'), {
      target: { value: 'Nog te filmen: saturatiemeter.' },
    });
    await user.click(screen.getByTestId('btn-nursing-answer-placeholder-save-partial'));
    expect(screen.getByTestId('nursing-answer-placeholder-saved-partial')).toHaveTextContent(
      'Placeholdertekst staat in deze vraag.',
    );
    expect(onStage).not.toHaveBeenCalled();
  });

  it('replaces an existing answer video in place and uploads a new file into the answer folder', async () => {
    const user = userEvent.setup();
    const staged: StagedNursingMediaOp[] = [];
    const initial = cloneNursingScenario();
    const step = initial.steps[0]!;
    const existing = optionPrimaryMediaPath(initial, optionForQuality(step, 'high'));
    expect(existing).toBeTruthy();
    expect(existing).not.toContain('/Antwoorden/');
    render(
      <Harness
        initial={initial}
        onStage={(op) => {
          staged.push(op);
        }}
      />,
    );

    const replacement = new File([new Uint8Array([1, 2])], 'andere-naam.mp4', {
      type: 'video/mp4',
    });
    await user.upload(screen.getByTestId('input-nursing-answer-replace-high'), replacement);
    expect(staged[0]?.relativePath).toBe(existing);
    expect(staged[0]?.type).toBe('replace');

    await user.click(screen.getByTestId('nursing-answer-mode-video-inappropriate'));
    const fresh = new File([new Uint8Array([3])], 'fout.mp4', { type: 'video/mp4' });
    await user.upload(screen.getByTestId('input-nursing-answer-upload-inappropriate'), fresh);
    expect(staged[1]?.type).toBe('add');
    expect(staged[1]?.relativePath).toBe(
      questionVideoRelative(resolvedQuestionFolder(initial.meta.title, step), 'inappropriate'),
    );
    expect(staged[1]?.relativePath).toBe(
      'gesprekstechnieken/ABCDE en SBAR bij acute benauwdheid-Vraag1/Videos/antwoord-verkeerd.mp4',
    );
    expect(optionPrimaryMediaPath(initial, optionForQuality(step, 'high'))).toBe(existing);
  });
});
