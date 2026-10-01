export const EDITOR_LAST_OPENED_KEY = 'holobox-editor-last-opened';

export type LastOpenedEditorModule = 'logopedie' | 'verpleegkunde';

export function readLastOpenedModule(): LastOpenedEditorModule | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(EDITOR_LAST_OPENED_KEY);
    if (!raw) {
      return null;
    }
    const data = JSON.parse(raw) as { module?: unknown };
    if (data.module === 'logopedie' || data.module === 'verpleegkunde') {
      return data.module;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeLastOpenedModule(moduleId: LastOpenedEditorModule): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(EDITOR_LAST_OPENED_KEY, JSON.stringify({ module: moduleId }));
  } catch {
    // localStorage can be blocked
  }
}
