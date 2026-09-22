import { withBaseUrl } from '../media/baseUrl';
import { aphasiaIntakeScenario } from './aphasiaIntakeScenario';
import { nursingPatient, nursingScenarioMeta } from '../nursing/scenario';

export type ScenarioTileModule = 'logopedie' | 'verpleegkunde';

export interface ScenarioTile {
  id: string;
  title: string;
  summary: string;
  module: ScenarioTileModule;
  source: 'builtin' | 'file';
}

export const DEFAULT_TILE_ID = 'builtin';

export function builtinLogopedieTile(): ScenarioTile {
  return {
    id: DEFAULT_TILE_ID,
    title: aphasiaIntakeScenario.title,
    summary: `Intake met ${aphasiaIntakeScenario.client.name}, fictieve cliënt met afasie na een beroerte.`,
    module: 'logopedie',
    source: 'builtin',
  };
}

export function builtinNursingTile(): ScenarioTile {
  return {
    id: DEFAULT_TILE_ID,
    title: nursingScenarioMeta.title,
    summary: `ABCDE en SBAR bij ${nursingPatient.name}, fictieve patiënt met acute benauwdheid.`,
    module: 'verpleegkunde',
    source: 'builtin',
  };
}

export function builtinTile(moduleId: ScenarioTileModule): ScenarioTile {
  return moduleId === 'logopedie' ? builtinLogopedieTile() : builtinNursingTile();
}

export async function fetchExtraScenarioTiles(
  moduleId: ScenarioTileModule,
  fetchImpl?: typeof fetch,
): Promise<ScenarioTile[]> {
  if (!fetchImpl && import.meta.env.MODE === 'test') {
    return [];
  }
  try {
    const fetchFn = fetchImpl ?? fetch;
    const response = await fetchFn(withBaseUrl(`/app-api/scenario-tiles?module=${moduleId}`), {
      cache: 'no-store',
    });
    if (!response.ok) {
      return [];
    }
    const payload = (await response.json()) as { tiles?: ScenarioTile[] };
    if (!Array.isArray(payload.tiles)) {
      return [];
    }
    return payload.tiles.filter(
      (tile) =>
        tile &&
        tile.id !== DEFAULT_TILE_ID &&
        tile.module === moduleId &&
        typeof tile.title === 'string' &&
        typeof tile.summary === 'string',
    );
  } catch {
    return [];
  }
}

export async function fetchScenarioEnvelope(
  tileId: string,
  moduleId: ScenarioTileModule,
  fetchImpl?: typeof fetch,
): Promise<string | null> {
  if (!fetchImpl && import.meta.env.MODE === 'test') {
    return null;
  }
  try {
    const fetchFn = fetchImpl ?? fetch;
    const response = await fetchFn(
      withBaseUrl(`/app-api/scenario-envelope?module=${moduleId}&id=${encodeURIComponent(tileId)}`),
      { cache: 'no-store' },
    );
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as { envelopeText?: string };
    return typeof payload.envelopeText === 'string' ? payload.envelopeText : null;
  } catch {
    return null;
  }
}
