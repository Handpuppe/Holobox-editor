import { describe, expect, it } from 'vitest';
import {
  builtinLogopedieTile,
  builtinNursingTile,
  DEFAULT_TILE_ID,
  fetchExtraScenarioTiles,
} from './scenarioTiles';

describe('scenario tiles', () => {
  it('always has a default logopedie and nursing tile', () => {
    const logopedie = builtinLogopedieTile();
    const nursing = builtinNursingTile();
    expect(logopedie.id).toBe(DEFAULT_TILE_ID);
    expect(logopedie.module).toBe('logopedie');
    expect(logopedie.title.length).toBeGreaterThan(0);
    expect(logopedie.summary.length).toBeGreaterThan(0);
    expect(nursing.id).toBe(DEFAULT_TILE_ID);
    expect(nursing.module).toBe('verpleegkunde');
    expect(nursing.title.length).toBeGreaterThan(0);
  });

  it('returns no extra tiles when the catalog API is missing', async () => {
    const extra = await fetchExtraScenarioTiles(
      'logopedie',
      async () => new Response('missing', { status: 404 }),
    );
    expect(extra).toEqual([]);
    await expect(
      fetchExtraScenarioTiles('verpleegkunde', async () => {
        throw new Error('network');
      }),
    ).resolves.toEqual([]);
  });
});
