import { describe, expect, it } from 'vitest';
import {
  builtinLogopedieTile,
  builtinNursingTile,
  DEFAULT_TILE_ID,
  fetchExtraScenarioTiles,
  fetchGesprekMenuTiles,
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

  it('lists only gesprek case files and keeps mevrouw De Boer fictional', async () => {
    const tiles = await fetchGesprekMenuTiles(async () => {
      return new Response(
        JSON.stringify({
          tiles: [
            {
              id: 'scenarios/logopedie.json',
              title: 'Logopedie',
              summary: 'Erik de Vries',
              module: 'logopedie',
              source: 'file',
            },
            {
              id: 'builtin',
              title: 'ABCDE en SBAR bij acute benauwdheid',
              summary: 'meneer de Vries',
              module: 'verpleegkunde',
              source: 'builtin',
            },
            {
              id: 'scenarios/verpleegkunde.json',
              title: 'Slechtnieuwsgesprek oefenen',
              summary: 'mevrouw De Boer, fictief',
              module: 'verpleegkunde',
              source: 'file',
            },
            {
              id: 'scenarios/verpleegkunde-testcasus.json',
              title: 'Phosaner testcasus',
              summary: 'testpatiënt, fictief',
              module: 'verpleegkunde',
              source: 'file',
            },
          ],
        }),
        { status: 200 },
      );
    });
    expect(tiles.map((tile) => tile.title)).toEqual([
      'Slechtnieuwsgesprek oefenen',
      'Phosaner testcasus',
    ]);
    expect(tiles[0]?.summary).toBe('mevrouw De Boer, fictief');
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
