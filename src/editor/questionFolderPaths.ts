export const QUESTION_TEXT_FILES = [
  'vraag-startvideo.txt',
  'antwoord-goed.txt',
  'antwoord-deels-goed.txt',
  'antwoord-verkeerd.txt',
  'antwoord-goed-extra.txt',
  'antwoord-deels-goed-extra.txt',
  'antwoord-verkeerd-extra.txt',
] as const;

export type QuestionTextFile = (typeof QUESTION_TEXT_FILES)[number];

const QUESTION_TEXT_FILE_SET = new Set<string>(QUESTION_TEXT_FILES);

export function isQuestionTextFile(name: string): name is QuestionTextFile {
  return QUESTION_TEXT_FILE_SET.has(name);
}

export function questionFolderOnDisk(folder: string): string {
  const normalized = folder.replaceAll('\\', '/').replace(/^\/+/, '').replace(/\/+$/, '');
  if (normalized.startsWith('verpleegkunde/')) {
    return `gesprekstechnieken/${normalized.slice('verpleegkunde/'.length)}`;
  }
  return normalized;
}

export function isQuestionFolderBackupName(name: string): boolean {
  if (isQuestionTextFile(name)) {
    return true;
  }
  if (!name.startsWith('Videos/')) {
    return false;
  }
  const base = name.slice('Videos/'.length);
  return base.length > 0 && !base.includes('/') && !base.includes('\\') && !base.includes('..');
}

export function isQuestionFolderPath(folder: string): boolean {
  const normalized = questionFolderOnDisk(folder);
  if (normalized.includes('..')) {
    return false;
  }
  const match = /^(gesprekstechnieken|logopedie)\/([^/]+)$/.exec(normalized);
  if (!match) {
    return false;
  }
  const moduleName = match[1] ?? '';
  const name = match[2] ?? '';
  if (!/^.+-Vraag\d+$/.test(name)) {
    return false;
  }
  const lower = name.toLowerCase();
  if (moduleName === 'gesprekstechnieken' && lower.includes('logopedie')) {
    return false;
  }
  if (
    moduleName === 'logopedie' &&
    (lower.includes('gesprekstechnieken') || lower.includes('verpleegkunde'))
  ) {
    return false;
  }
  return true;
}
