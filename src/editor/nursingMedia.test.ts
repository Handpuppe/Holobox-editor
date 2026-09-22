import { describe, expect, it } from 'vitest';
import { applyStagedNursingMedia, isNursingMediaPath, nursingMediaRowTestId } from './nursingMedia';

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
});
