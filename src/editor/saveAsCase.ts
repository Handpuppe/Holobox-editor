import { withBaseUrl } from '../media/baseUrl';
import { EDITOR_SAVE_AS_CASE_PATH, newCaseFileName, type EditorCaseModule } from './newCaseFile';

export async function saveEnvelopeAsNewCase(
  moduleId: EditorCaseModule,
  envelopeText: string,
  title: string,
): Promise<{ ok: true; file: string } | { ok: false; error: string }> {
  try {
    const response = await fetch(withBaseUrl(EDITOR_SAVE_AS_CASE_PATH), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        module: moduleId,
        envelopeText,
        fileName: newCaseFileName(moduleId, title),
      }),
    });
    let payload: { ok?: boolean; error?: string; file?: string } = {};
    try {
      payload = (await response.json()) as typeof payload;
    } catch {
      payload = {};
    }
    if (!response.ok || !payload.ok || !payload.file) {
      return { ok: false, error: payload.error ?? 'Opslaan als nieuwe casus is mislukt.' };
    }
    return { ok: true, file: payload.file };
  } catch {
    return {
      ok: false,
      error: 'Opslaan is niet beschikbaar. Start de bewerker via Editor.exe of npm run dev.',
    };
  }
}
