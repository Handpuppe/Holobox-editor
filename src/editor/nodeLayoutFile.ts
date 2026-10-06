export const EDITOR_NODE_LAYOUT_PATH = '/editor-api/node-layout';

export interface StoredNodeLayout {
  [cardId: string]: { x: number; y: number };
}

export function caseFileNameForModule(
  moduleId: 'logopedie' | 'verpleegkunde',
  fileName: string,
): string | null {
  const name = fileName.replaceAll('\\', '/').split('/').pop() ?? '';
  if (
    !name ||
    name.includes('..') ||
    name.includes('/') ||
    !name.endsWith('.json') ||
    name.endsWith('.bak')
  ) {
    return null;
  }
  if (name !== `${moduleId}.json` && !name.startsWith(`${moduleId}-`)) {
    return null;
  }
  return name;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseStoredNodeLayout(value: unknown): StoredNodeLayout | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const layout: StoredNodeLayout = {};
  for (const [key, point] of Object.entries(value)) {
    if (!key || !isRecord(point)) {
      continue;
    }
    const x = point.x;
    const y = point.y;
    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      continue;
    }
    layout[key] = { x, y };
  }
  return Object.keys(layout).length > 0 ? layout : undefined;
}

/** Zet alleen nodeLayout in een bestaand casusbestand. De rest van de casus blijft staan. */
export function embedNodeLayout(
  text: string,
  moduleId: 'logopedie' | 'verpleegkunde',
  layout: StoredNodeLayout,
): { ok: true; json: string } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Dit bestand is geen geldige JSON.' };
  }
  if (!isRecord(data)) {
    return { ok: false, error: 'Het JSON-bestand heeft niet de verwachte vorm.' };
  }
  const stored = parseStoredNodeLayout(layout);
  if (moduleId === 'verpleegkunde') {
    if (data.module !== 'verpleegkunde' || !Array.isArray(data.steps)) {
      return { ok: false, error: 'Alleen een Verpleegkunde-casus kan nodeposities bewaren.' };
    }
    if (stored) {
      data.nodeLayout = stored;
    } else {
      delete data.nodeLayout;
    }
  } else if (data.module !== 'logopedie' || !isRecord(data.scenario)) {
    return { ok: false, error: 'Alleen een Logopedie-casus kan nodeposities bewaren.' };
  } else if (stored) {
    data.scenario.nodeLayout = stored;
  } else {
    delete data.scenario.nodeLayout;
  }
  return { ok: true, json: `${JSON.stringify(data, null, 2)}\n` };
}
