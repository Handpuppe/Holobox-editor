export const EDITOR_SAVE_AS_CASE_PATH = '/editor-api/save-as-case';
export const EDITOR_DELETE_CASE_PATH = '/editor-api/delete-case';

export type EditorCaseModule = 'logopedie' | 'verpleegkunde';

export function overlayScenarioFileName(moduleId: EditorCaseModule): string {
  return moduleId === 'logopedie' ? 'logopedie.json' : 'verpleegkunde.json';
}

export function newCaseFileName(
  moduleId: EditorCaseModule,
  title: string,
  at = new Date(),
): string {
  const slug = title
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const stamp = at.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const base = slug.length > 0 ? `${moduleId}-${slug}` : `${moduleId}-casus`;
  const name = `${base}-${stamp}.json`;
  if (name === overlayScenarioFileName(moduleId) || name === overlayScenarioFileName('logopedie')) {
    return `${moduleId}-casus-${stamp}.json`;
  }
  return name;
}
