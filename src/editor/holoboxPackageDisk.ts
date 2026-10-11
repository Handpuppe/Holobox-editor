import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';
import {
  HOLOBOX_PACKAGE_DIR,
  holoboxStartPrefix,
  holoboxZipRelative,
  isHoloboxVideoPath,
  safeHoloboxPackageTitle,
} from './holoboxPackagePaths';
import { isQuestionFolderPath, questionFolderOnDisk } from './questionFolderPaths';

export { holoboxZipRelative };

function insideRoot(root: string, abs: string): boolean {
  const base = resolve(root);
  return abs.startsWith(base + sep);
}

export function packageZipPath(
  projectRoot: string,
  title: string,
  previous = false,
): string | null {
  const relativePath = holoboxZipRelative(title, previous);
  if (!relativePath) {
    return null;
  }
  const root = resolve(projectRoot);
  const abs = resolve(root, ...relativePath.split('/'));
  const allowed = previous ? resolve(root, 'pakketten', 'vorige') : resolve(root, 'pakketten');
  if (!insideRoot(allowed, abs) || !abs.toLowerCase().endsWith('.zip')) {
    return null;
  }
  return abs;
}

export function holoboxPackageExists(projectRoot: string, title: string): boolean {
  const dest = packageZipPath(projectRoot, title, false);
  return Boolean(dest && existsSync(dest));
}

export function listHoloboxPackageTitles(projectRoot: string): string[] {
  const dir = resolve(projectRoot, HOLOBOX_PACKAGE_DIR);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    return [];
  }
  const titles: string[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.toLowerCase().endsWith('.zip') || name.startsWith('.')) {
      continue;
    }
    const title = name.slice(0, -4);
    if (safeHoloboxPackageTitle(title) !== title) {
      continue;
    }
    const abs = join(dir, name);
    if (!statSync(abs).isFile()) {
      continue;
    }
    titles.push(title);
  }
  titles.sort((left, right) => left.localeCompare(right, 'nl') || left.localeCompare(right));
  return titles;
}

export function readHoloboxPackageBytes(projectRoot: string, title: string): Uint8Array | null {
  const dest = packageZipPath(projectRoot, title, false);
  if (!dest || !existsSync(dest) || !statSync(dest).isFile()) {
    return null;
  }
  return new Uint8Array(readFileSync(dest));
}

function existingVideo(resourcesRoot: string, relativePath: string): string | null {
  const rel = relativePath.replaceAll('\\', '/').replace(/^\/+/, '');
  if (
    !rel.startsWith('gesprekstechnieken/') ||
    rel.includes('..') ||
    rel.toLowerCase().includes('logopedie') ||
    !isHoloboxVideoPath(rel)
  ) {
    return null;
  }
  const root = resolve(resourcesRoot);
  const abs = resolve(root, ...rel.split('/'));
  if (!insideRoot(root, abs) || !existsSync(abs) || !statSync(abs).isFile()) {
    return null;
  }
  return rel;
}

function videoNamesIn(dir: string): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    return [];
  }
  return readdirSync(dir).filter(
    (name) => !name.includes('/') && !name.includes('\\') && !name.includes('..'),
  );
}

export function listHoloboxDiskFiles(
  resourcesRoot: string,
  title: string,
  folders: string[],
  extraVideos: string[] = [],
): string[] {
  const found = new Set<string>();
  const root = resolve(resourcesRoot);
  for (const folder of folders) {
    const disk = questionFolderOnDisk(folder);
    if (!isQuestionFolderPath(disk) || !disk.startsWith('gesprekstechnieken/')) {
      continue;
    }
    const videosDir = resolve(root, ...disk.split('/'), 'Videos');
    if (!insideRoot(root, videosDir)) {
      continue;
    }
    for (const name of videoNamesIn(videosDir)) {
      const rel = existingVideo(resourcesRoot, `${disk}/Videos/${name}`);
      if (rel) {
        found.add(rel);
      }
    }
  }
  const dashed = holoboxStartPrefix(title);
  const startDir = join(root, 'gesprekstechnieken', 'Startvideos');
  if (dashed && !dashed.includes('..')) {
    for (const name of videoNamesIn(startDir)) {
      if (!name.startsWith(`${dashed}-Vraag`)) {
        continue;
      }
      const rel = existingVideo(resourcesRoot, `gesprekstechnieken/Startvideos/${name}`);
      if (rel) {
        found.add(rel);
      }
    }
  }
  for (const extra of extraVideos) {
    const rel = existingVideo(resourcesRoot, extra);
    if (rel) {
      found.add(rel);
    }
  }
  return [...found].sort();
}

export function writeHoloboxPackageFile(
  projectRoot: string,
  title: string,
  zipBytes: Uint8Array,
  replace: boolean,
): { ok: true; zip: string; replaced: boolean } | { ok: false; error: string; exists?: boolean } {
  const dest = packageZipPath(projectRoot, title, false);
  const previous = packageZipPath(projectRoot, title, true);
  const zip = holoboxZipRelative(title);
  if (!dest || !previous || !zip) {
    return { ok: false, error: 'De casusnaam is ongeldig voor een pakket.' };
  }
  if (zipBytes.length < 4) {
    return { ok: false, error: 'Het pakket is leeg.' };
  }
  mkdirSync(dirname(dest), { recursive: true });
  const partial = join(dirname(dest), `.${basename(dest)}.partial`);
  writeFileSync(partial, zipBytes);
  try {
    const replaced = existsSync(dest);
    if (replaced && !replace) {
      unlinkSync(partial);
      return {
        ok: false,
        exists: true,
        error: 'Er bestaat al een pakket met deze casusnaam.',
      };
    }
    if (replaced) {
      mkdirSync(dirname(previous), { recursive: true });
      if (existsSync(previous)) {
        unlinkSync(previous);
      }
      renameSync(dest, previous);
    }
    renameSync(partial, dest);
    return { ok: true, zip, replaced };
  } catch {
    if (existsSync(partial)) {
      unlinkSync(partial);
    }
    return { ok: false, error: 'Het pakket kon niet worden opgeslagen.' };
  }
}
