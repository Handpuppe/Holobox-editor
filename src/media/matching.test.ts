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
import type { MediaManifestItem } from './types';

function sampleItem(relativePath: string, keywords: string[]): MediaManifestItem {
  return {
    relativePath,
    module: 'verpleegkunde',
    fileType: 'video',
    extension: '.mp4',
    sizeBytes: 1,
    normalizedName: relativePath.toLowerCase(),
    keywords,
    durationSeconds: null,
    width: null,
    height: null,
    publicUrl: `/resources/${relativePath}`,
    warnings: [],
  };
}

describe('media matching', () => {
  it('lists no bundled nursing videos when the manifest is empty', () => {
    const items = mediaManifest.items as readonly MediaManifestItem[];
    const nursing = items.filter((item) => item.module === 'verpleegkunde');
    expect(nursing).toHaveLength(0);
  });

  it('ranks nothing when the manifest has no videos', () => {
    expect(rankCandidates('verpleegkunde', ['luchtweg', 'airway'])).toEqual([]);
  });

  it('is deterministic when scores tie', () => {
    const first = rankCandidates('verpleegkunde', ['mp4']).map((item) => item.relativePath);
    const second = rankCandidates('verpleegkunde', ['mp4']).map((item) => item.relativePath);
    expect(first).toEqual(second);
  });

  it('does not treat a missing file as an override', () => {
    const picked = pickPrimary(
      'verpleegkunde',
      ['luchtweg'],
      'gesprekstechnieken/Staat is pijn.mp4',
    );
    expect(picked.primary).toBeNull();
  });

  it('scores higher when more keywords match', () => {
    const airway = sampleItem('gesprekstechnieken/luchtweg.mp4', ['luchtweg', 'airway']);
    const pain = sampleItem('gesprekstechnieken/pijn.mp4', ['pijn']);
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
