import { describe, expect, it } from 'vitest';
import { cloneNursingScenario } from './cloneNursing';
import {
  applyStagedNursingMedia,
  assignStepPrimaryMedia,
  isNursingMediaPath,
  nursingMediaRowTestId,
  nursingRelativePathForFile,
  stepPrimaryMediaPath,
  unlinkDeletedNursingMedia,
} from './nursingMedia';

describe('nursing editor media paths', () => {
  it('allows only media files under resources/verpleegkunde', () => {
    expect(isNursingMediaPath('verpleegkunde/Staat is pijn.mp4')).toBe(true);
    expect(isNursingMediaPath('verpleegkunde/nieuw.png')).toBe(true);
    expect(isNursingMediaPath('logopedie/avatar/erik_basis.png')).toBe(false);
    expect(isNursingMediaPath('verpleegkunde/../logopedie/avatar/erik_basis.png')).toBe(false);
    expect(isNursingMediaPath('verpleegkunde/notes.txt')).toBe(false);
    expect(nursingMediaRowTestId('verpleegkunde/Staat is pijn.mp4')).toBe(
      'nursing-media-row-verpleegkunde_Staat is pijn.mp4',
    );
  });

  it('applies staged add, replace and delete without touching logopedie files', () => {
    const items = [
      { relativePath: 'verpleegkunde/Staat is pijn.mp4', sizeBytes: 10 },
      { relativePath: 'verpleegkunde/Staat is koorts.mp4', sizeBytes: 20 },
    ];
    const file = new File([new Uint8Array([1, 2, 3])], 'Staat is pijn.mp4', { type: 'video/mp4' });
    const listed = applyStagedNursingMedia(items, [
      {
        type: 'replace',
        relativePath: 'verpleegkunde/Staat is pijn.mp4',
        file,
        previewUrl: 'blob:preview',
      },
      { type: 'delete', relativePath: 'verpleegkunde/Staat is koorts.mp4' },
      {
        type: 'add',
        relativePath: 'verpleegkunde/nieuw.mp4',
        file,
        previewUrl: 'blob:new',
      },
    ]);
    expect(listed.map((item) => item.relativePath)).toEqual([
      'verpleegkunde/nieuw.mp4',
      'verpleegkunde/Staat is pijn.mp4',
    ]);
    expect(
      listed.find((item) => item.relativePath === 'verpleegkunde/Staat is pijn.mp4')?.previewUrl,
    ).toBe('blob:preview');
  });

  it('builds a verpleegkunde path from a file name and rejects logopedie names', () => {
    expect(nursingRelativePathForFile('nieuwe-observatie.mp4')).toBe(
      'verpleegkunde/nieuwe-observatie.mp4',
    );
    expect(nursingRelativePathForFile('..\\logopedie\\avatar\\erik_basis.png')).toBe(null);
    expect(nursingRelativePathForFile('notes.txt')).toBe(null);
  });

  it('assigns a new video to one step without rewriting shared slots or logopedie paths', () => {
    const draft = cloneNursingScenario();
    const first = draft.steps[0]!;
    const sharedSlot = first.mediaSlotId;
    const originalPath = stepPrimaryMediaPath(draft, first);
    expect(originalPath).toBeTruthy();
    const other = draft.steps.find(
      (step) => step.id !== first.id && step.mediaSlotId === sharedSlot,
    );
    expect(other).toBeTruthy();

    const next = assignStepPrimaryMedia(draft, first.id, 'verpleegkunde/nieuw.mp4');
    expect(stepPrimaryMediaPath(next, next.steps[0]!)).toBe('verpleegkunde/nieuw.mp4');
    expect(next.steps[0]?.mediaSlotId).not.toBe(sharedSlot);
    const untouched = next.steps.find((step) => step.id === other?.id);
    expect(untouched?.mediaSlotId).toBe(sharedSlot);
    expect(stepPrimaryMediaPath(next, untouched!)).toBe(originalPath);
    expect(assignStepPrimaryMedia(draft, first.id, 'logopedie/avatar/erik_basis.png')).toBe(draft);

    const unlinked = assignStepPrimaryMedia(next, first.id, null);
    expect(stepPrimaryMediaPath(unlinked, unlinked.steps[0]!)).toBeNull();
    expect(stepPrimaryMediaPath(unlinked, untouched!)).toBe(originalPath);

    const deleted = unlinkDeletedNursingMedia(draft, originalPath ?? '');
    expect(deleted.mediaSlots.some((slot) => slot.primaryMedia === originalPath)).toBe(false);
  });
});
