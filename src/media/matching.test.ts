import { describe, expect, it } from 'vitest';
import { pickPrimary, rankCandidates, scoreMediaItem } from './matching';
import { mediaManifest } from './generated/media-manifest';

describe('media matching', () => {
  it('finds the nine nursing videos', () => {
    const nursing = mediaManifest.items.filter((item) => item.module === 'verpleegkunde');
    expect(nursing).toHaveLength(9);
    expect(nursing.every((item) => item.fileType === 'video')).toBe(true);
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
    const path = 'verpleegkunde/Staat is pijn.mp4';
    const picked = pickPrimary('verpleegkunde', ['luchtweg'], path);
    expect(picked.primary?.relativePath).toBe(path);
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
});
