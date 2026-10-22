import { withBaseUrl } from '../media/baseUrl';
import { canSaveToThisCopy } from './editorHost';

export const EDITOR_QUIT_TAB_MESSAGE = 'Sluit het tabblad';

/** Lokaal stopt Editor.exe. In de browser sluit alleen het tabblad. */
export async function requestEditorQuit(): Promise<'local' | 'browser'> {
  if (!canSaveToThisCopy()) {
    window.close();
    return 'browser';
  }
  try {
    await fetch(withBaseUrl('/editor-api/quit?immediate=1'), { method: 'POST' });
  } catch {
    // Het venster sluit ook als de server het script niet kon starten.
  }
  window.close();
  return 'local';
}
