import { withBaseUrl } from '../media/baseUrl';
import { EDITOR_DELETE_CASE_PATH } from './newCaseFile';

export const EDITOR_CASES_PATH = '/editor-api/cases';

export interface EditorCaseListItem {
  file: string;
  title: string;
  savedAt?: string;
}

export function formatCaseSavedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export async function listEditorCases(
  moduleId: 'logopedie' | 'verpleegkunde',
): Promise<EditorCaseListItem[]> {
  const response = await fetch(withBaseUrl(`${EDITOR_CASES_PATH}?module=${moduleId}`), {
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error('De casussen konden niet worden geladen.');
  }
  const payload = (await response.json()) as { cases?: EditorCaseListItem[] };
  return Array.isArray(payload.cases) ? payload.cases : [];
}

export async function deleteEditorCaseOnDisk(
  moduleId: 'logopedie' | 'verpleegkunde',
  file: string,
  folders: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch(withBaseUrl(EDITOR_DELETE_CASE_PATH), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module: moduleId, file, folders }),
    });
    let payload: { ok?: boolean; error?: string } = {};
    try {
      payload = (await response.json()) as typeof payload;
    } catch {
      payload = {};
    }
    if (!response.ok || !payload.ok) {
      return { ok: false, error: payload.error ?? 'De casus kon niet worden verwijderd.' };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: 'Verwijderen is niet beschikbaar. Start de bewerker via Editor.exe of npm run dev.',
    };
  }
}
