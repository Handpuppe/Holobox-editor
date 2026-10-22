import { holoboxStartPrefix, isHoloboxVideoPath } from './holoboxPackagePaths';
import {
  isQuestionFolderPath,
  isQuestionTextFile,
  questionFolderOnDisk,
} from './questionFolderPaths';

export interface HoloboxImportFile {
  name: string;
  data: Uint8Array;
}

export type HoloboxImportPlan =
  | { ok: true; caseFile: string; envelopeText: string; files: HoloboxImportFile[] }
  | { ok: false; error: string };

function caseFolderName(title: string): string {
  let cleaned = '';
  for (const char of title.trim()) {
    const code = char.charCodeAt(0);
    cleaned += code < 32 || '<>:"/\\|?*'.includes(char) ? ' ' : char;
  }
  cleaned = cleaned.replace(/\.\./g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || 'scenario';
}

function questionNumber(stepName: string): string {
  const match = /^Vraag\.(\d+)$/.exec(stepName.trim());
  return match?.[1] ?? '1';
}

export function safeHoloboxImportPath(name: string): string | null {
  const normalized = name.replaceAll('\\', '/').replace(/^\/+/, '');
  if (
    !normalized ||
    normalized.endsWith('/') ||
    normalized.includes('..') ||
    normalized.toLowerCase().includes('logopedie')
  ) {
    return null;
  }
  if (normalized.startsWith('scenarios/')) {
    const base = normalized.slice('scenarios/'.length);
    const named =
      base.startsWith('verpleegkunde-') &&
      base.endsWith('.json') &&
      base.length > 'verpleegkunde-.json'.length;
    if (base.includes('/') || (base !== 'verpleegkunde.json' && !named)) {
      return null;
    }
    return normalized;
  }
  if (!normalized.startsWith('gesprekstechnieken/')) {
    return null;
  }
  const rest = normalized.slice('gesprekstechnieken/'.length);
  if (rest.startsWith('Startvideos/')) {
    const file = rest.slice('Startvideos/'.length);
    if (!file || file.includes('/') || !isHoloboxVideoPath(file)) {
      return null;
    }
    return normalized;
  }
  const parts = rest.split('/');
  if (parts.length === 2) {
    const folder = `gesprekstechnieken/${parts[0] ?? ''}`;
    if (!isQuestionFolderPath(folder) || !isQuestionTextFile(parts[1] ?? '')) {
      return null;
    }
    return normalized;
  }
  if (parts.length === 3 && parts[1] === 'Videos') {
    const folder = `gesprekstechnieken/${parts[0] ?? ''}`;
    const file = parts[2] ?? '';
    if (!isQuestionFolderPath(folder) || !file || file.includes('/') || !isHoloboxVideoPath(file)) {
      return null;
    }
    return normalized;
  }
  return null;
}

function stepFolder(
  title: string,
  step: { questionFolder?: unknown; stepName?: unknown },
): string | null {
  if (typeof step.questionFolder === 'string' && step.questionFolder.trim()) {
    const disk = questionFolderOnDisk(step.questionFolder);
    if (isQuestionFolderPath(disk) && disk.startsWith('gesprekstechnieken/')) {
      return disk;
    }
  }
  const stepName = typeof step.stepName === 'string' ? step.stepName : '';
  const folder = `gesprekstechnieken/${caseFolderName(title)}-Vraag${questionNumber(stepName)}`;
  return isQuestionFolderPath(folder) ? folder : null;
}

function envelopeAllows(
  path: string,
  title: string,
  folders: Set<string>,
  extras: Set<string>,
): boolean {
  if (extras.has(path)) {
    return true;
  }
  for (const folder of folders) {
    if (path.startsWith(`${folder}/`)) {
      const rest = path.slice(folder.length + 1);
      if (isQuestionTextFile(rest)) {
        return true;
      }
      if (rest.startsWith('Videos/')) {
        const file = rest.slice('Videos/'.length);
        return file.length > 0 && !file.includes('/') && isHoloboxVideoPath(file);
      }
    }
  }
  const prefix = holoboxStartPrefix(title);
  return (
    prefix.length > 0 &&
    path.startsWith(`gesprekstechnieken/Startvideos/${prefix}-Vraag`) &&
    isHoloboxVideoPath(path)
  );
}

/** Kiest de casus, placeholders en video's. Een pad buiten die casus laat de hele import vallen. */
export function selectHoloboxImportFiles(files: HoloboxImportFile[]): HoloboxImportPlan {
  if (files.length === 0) {
    return { ok: false, error: 'Het pakket bevat geen casus.' };
  }
  const normalized: HoloboxImportFile[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    const name = safeHoloboxImportPath(file.name);
    if (!name || seen.has(name)) {
      return { ok: false, error: 'Het pakket bevat bestanden buiten deze casus.' };
    }
    seen.add(name);
    normalized.push({ name, data: file.data });
  }
  const scenarios = normalized.filter((file) => file.name.startsWith('scenarios/'));
  if (scenarios.length !== 1) {
    return { ok: false, error: 'Het pakket bevat geen casus.' };
  }
  const scenario = scenarios[0];
  if (!scenario) {
    return { ok: false, error: 'Het pakket bevat geen casus.' };
  }
  let data: {
    module?: unknown;
    meta?: { title?: unknown };
    steps?: Array<{ questionFolder?: unknown; stepName?: unknown }>;
    mediaSlots?: Array<{ primaryMedia?: unknown }>;
  };
  try {
    data = JSON.parse(new TextDecoder().decode(scenario.data)) as typeof data;
  } catch {
    return { ok: false, error: 'Het pakket bevat geen casus.' };
  }
  const title = typeof data.meta?.title === 'string' ? data.meta.title.trim() : '';
  if (data.module !== 'verpleegkunde' || !title || !Array.isArray(data.steps)) {
    return { ok: false, error: 'Het pakket bevat geen casus.' };
  }
  const folders = new Set<string>();
  for (const step of data.steps) {
    if (!step || typeof step !== 'object') {
      continue;
    }
    const folder = stepFolder(title, step);
    if (folder) {
      folders.add(folder);
    }
  }
  const extras = new Set<string>();
  for (const slot of data.mediaSlots ?? []) {
    if (!slot || typeof slot.primaryMedia !== 'string') {
      continue;
    }
    const media = safeHoloboxImportPath(slot.primaryMedia);
    if (media) {
      extras.add(media);
    }
  }
  for (const file of normalized) {
    if (file.name.startsWith('scenarios/')) {
      continue;
    }
    if (!envelopeAllows(file.name, title, folders, extras)) {
      return { ok: false, error: 'Het pakket bevat bestanden buiten deze casus.' };
    }
  }
  const envelopeText = new TextDecoder().decode(scenario.data);
  if (!envelopeText.trim()) {
    return { ok: false, error: 'Het pakket bevat geen casus.' };
  }
  return {
    ok: true,
    caseFile: scenario.name.slice('scenarios/'.length),
    envelopeText,
    files: normalized,
  };
}
