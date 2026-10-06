import { describe, expect, it } from 'vitest';
import {
  mediaItemFromRelativePath,
  pickPrimary,
  rankCandidates,
  resolveSlot,
  scoreMediaItem,
} from './matching';
import { mediaSlots } from './scenarioMedia';
import { mediaManifest } from './generated/media-manifest';

describe('media matching', () => {
  it('finds the nursing videos', () => {
    const items = mediaManifest.items as readonly {
      module: string;
      fileType: string;
      relativePath: string;
    }[];
    const nursing = items.filter((item) => item.module === 'verpleegkunde');
    expect(nursing).toHaveLength(7);
    expect(nursing.every((item) => item.fileType === 'video')).toBe(true);
    expect(nursing.every((item) => item.relativePath.startsWith('gesprekstechnieken/'))).toBe(true);
  });

  it('ranks airway video first for airway keywords', () => {
    const ranked = rankCandidates('verpleegkunde', ['luchtweg', 'airway']);
    expect(ranked[0]?.relativePath).toContain('luchtweg');
  });

  it('is deterministic when scores tie', () => {
    const first = rankCandidates('verpleegkunde', ['mp4']).map((item) => item.relativePath);
    const second = rankCandidates('verpleegkunde', ['mp4']).map((item) => item.relativePath);
    expect(first).toEqual(second);
  });

  it('uses an override path when valid', () => {
    const path =
      mediaManifest.items.find((item) => item.relativePath.endsWith('/Staat is pijn.mp4'))
        ?.relativePath ?? '';
    expect(path).not.toBe('');
    const picked = pickPrimary('verpleegkunde', ['luchtweg'], path);
    expect(picked.primary?.relativePath).toBe(path);
    const legacy = pickPrimary('verpleegkunde', ['luchtweg'], 'verpleegkunde/Staat is pijn.mp4');
    expect(legacy.primary?.relativePath).toBe(path);
  });

  it('scores higher when more keywords match', () => {
    const airway = mediaManifest.items.find((item) => item.relativePath.includes('luchtweg'));
    const pain = mediaManifest.items.find((item) => item.relativePath.includes('pijn'));
    if (!airway || !pain) {
      throw new Error('testdata ontbreekt');
    }
    expect(scoreMediaItem(airway, ['luchtweg', 'airway'])).toBeGreaterThan(
      scoreMediaItem(pain, ['luchtweg', 'airway']),
    );
  });

  it('does not invent a video when a slot is explicitly unlinked', () => {
    const slot = { ...mediaSlots[0]!, primaryMedia: null };
    expect(resolveSlot(slot).media).toBeNull();
  });

  it('still resolves a nursing path that is not in the bundled manifest', () => {
    const synthetic = mediaItemFromRelativePath('verpleegkunde/nieuw-bestand.mp4', 'verpleegkunde');
    expect(synthetic.module).toBe('verpleegkunde');
    expect(synthetic.fileType).toBe('video');
    expect(synthetic.publicUrl).toContain('verpleegkunde');
    const slot = {
      ...mediaSlots[0]!,
      primaryMedia: 'verpleegkunde/nieuw-bestand.mp4',
    };
    expect(resolveSlot(slot).media?.relativePath).toBe('verpleegkunde/nieuw-bestand.mp4');
  });
});
