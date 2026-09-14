import { describe, expect, it } from 'vitest';
import { LOGOPEDIE_BASIS_PATH } from '../media/logopedie/resolveAvatar';
import {
  applyStagedMedia,
  isErikBasisPath,
  isLogopedieMediaPath,
  mediaRowTestId,
} from './logopedieMedia';

describe('logopedie editor media paths', () => {
  it('allows only image files under resources/logopedie', () => {
    expect(isLogopedieMediaPath('logopedie/avatar/erik_basis.png')).toBe(true);
    expect(isLogopedieMediaPath('logopedie/avatar/generated/erik/gefrustreerd.png')).toBe(true);
    expect(isLogopedieMediaPath('verpleegkunde/Staat is pijn.mp4')).toBe(false);
    expect(isLogopedieMediaPath('logopedie/../verpleegkunde/Staat is pijn.mp4')).toBe(false);
    expect(isLogopedieMediaPath('logopedie/avatar/notes.txt')).toBe(false);
    expect(isErikBasisPath(LOGOPEDIE_BASIS_PATH)).toBe(true);
    expect(isErikBasisPath('logopedie/avatar/generated/erik/neutraal.png')).toBe(false);
    expect(mediaRowTestId(LOGOPEDIE_BASIS_PATH)).toBe('media-row-logopedie_avatar_erik_basis.png');
  });

  it('applies staged add, replace and delete without touching nursing files', () => {
    const items = [
      { relativePath: 'logopedie/avatar/erik_basis.png', sizeBytes: 10 },
      { relativePath: 'logopedie/avatar/generated/erik/gefrustreerd.png', sizeBytes: 20 },
    ];
    const file = new File([new Uint8Array([1, 2, 3])], 'gefrustreerd.png', { type: 'image/png' });
    const listed = applyStagedMedia(items, [
      {
        type: 'replace',
        relativePath: 'logopedie/avatar/generated/erik/gefrustreerd.png',
        file,
        previewUrl: 'blob:preview',
        replaceBasis: false,
      },
      { type: 'delete', relativePath: 'logopedie/avatar/erik_basis.png' },
      {
        type: 'add',
        relativePath: 'logopedie/avatar/nieuw.png',
        file,
        previewUrl: 'blob:new',
        replaceBasis: false,
      },
    ]);
    expect(listed.map((item) => item.relativePath)).toEqual([
      'logopedie/avatar/generated/erik/gefrustreerd.png',
      'logopedie/avatar/nieuw.png',
    ]);
    expect(listed[0]?.previewUrl).toBe('blob:preview');
  });
});
