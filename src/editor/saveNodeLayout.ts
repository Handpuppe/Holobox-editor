import { withBaseUrl } from '../media/baseUrl';
import type { NodeLayout } from '../domain/types';
import { EDITOR_NODE_LAYOUT_PATH } from './nodeLayoutFile';

export async function saveNodeLayoutToCase(
  moduleId: 'logopedie' | 'verpleegkunde',
  fileName: string,
  layout: NodeLayout,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch(withBaseUrl(EDITOR_NODE_LAYOUT_PATH), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module: moduleId, file: fileName, nodeLayout: layout }),
    });
    if (!response.ok) {
      let message = 'De nodeposities zijn niet in het casusbestand opgeslagen.';
      try {
        const payload = (await response.json()) as { error?: string };
        if (typeof payload.error === 'string' && payload.error.trim()) {
          message = payload.error;
        }
      } catch {
        // keep default
      }
      return { ok: false, error: message };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: 'De nodeposities zijn niet opgeslagen. Start de bewerker via Editor.exe.',
    };
  }
}
