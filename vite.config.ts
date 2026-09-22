import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  createReadStream,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { unzipStore, zipStore, type ZipEntry } from './src/editor/zipStore';

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string };

const MAX_EDITOR_BODY_BYTES = 8_000_000;
const MAX_EDITOR_MEDIA_BYTES = 16_000_000;
const MAX_EDITOR_PACKAGE_BYTES = 64_000_000;

const APP_BASE = '/Holobox-editor/';
const LEGACY_LOCAL_BASE = '/HoloboxVPKenLogo';

function rewriteLegacyBase(req: IncomingMessage): void {
  const url = req.url ?? '';
  if (url === LEGACY_LOCAL_BASE || url.startsWith(`${LEGACY_LOCAL_BASE}/`)) {
    req.url = url.replace(LEGACY_LOCAL_BASE, APP_BASE.slice(0, -1)) || APP_BASE;
  }
}

function requestPath(url: string | undefined): string {
  return decodeURIComponent((url ?? '').split('?')[0] ?? '');
}

function editorSaveModule(url: string | undefined): 'logopedie' | 'verpleegkunde' | null {
  const path = requestPath(url);
  if (path === '/editor-api/save-logopedie' || path.endsWith('/editor-api/save-logopedie')) {
    return 'logopedie';
  }
  if (
    path === '/editor-api/save-verpleegkunde' ||
    path.endsWith('/editor-api/save-verpleegkunde')
  ) {
    return 'verpleegkunde';
  }
  return null;
}

function isEditorMediaPath(url: string | undefined): boolean {
  const path = requestPath(url);
  return path === '/editor-api/logopedie-media' || path.includes('/editor-api/logopedie-media');
}

function isNursingEditorMediaPath(url: string | undefined): boolean {
  const path = requestPath(url);
  return (
    path === '/editor-api/verpleegkunde-media' || path.includes('/editor-api/verpleegkunde-media')
  );
}

function isEditorExportPath(url: string | undefined): boolean {
  const path = requestPath(url);
  return path === '/editor-api/export-package' || path.includes('/editor-api/export-package');
}

function isEditorExportFilePath(url: string | undefined): boolean {
  const path = requestPath(url);
  return path === '/editor-api/export-file' || path.includes('/editor-api/export-file');
}

function isEditorImportMediaPath(url: string | undefined): boolean {
  const path = requestPath(url);
  return path === '/editor-api/import-media' || path.includes('/editor-api/import-media');
}

function isScenarioTilesPath(url: string | undefined): boolean {
  const path = requestPath(url);
  return path === '/app-api/scenario-tiles' || path.includes('/app-api/scenario-tiles');
}

function isScenarioEnvelopePath(url: string | undefined): boolean {
  const path = requestPath(url);
  return path === '/app-api/scenario-envelope' || path.includes('/app-api/scenario-envelope');
}

const LOGOPEDIE_IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif']);
const NURSING_MEDIA_EXT = new Set([
  '.mp4',
  '.webm',
  '.mov',
  '.m4v',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.avif',
]);
const ERIK_BASIS_REL = 'logopedie/avatar/erik_basis.png';

function safeLogopedieRel(input: string, resourcesRoot: string): string | null {
  const normalized = input.replaceAll('\\', '/').replace(/^\/+/, '');
  if (
    !normalized.startsWith('logopedie/') ||
    normalized.includes('..') ||
    normalized.includes('verpleegkunde')
  ) {
    return null;
  }
  if (!LOGOPEDIE_IMAGE_EXT.has(extname(normalized).toLowerCase())) {
    return null;
  }
  const abs = resolve(resourcesRoot, normalized);
  const logopedieRoot = resolve(resourcesRoot, 'logopedie');
  if (abs !== logopedieRoot && !abs.startsWith(logopedieRoot + sep)) {
    return null;
  }
  return normalized;
}

function safeNursingRel(input: string, resourcesRoot: string): string | null {
  const normalized = input.replaceAll('\\', '/').replace(/^\/+/, '');
  if (
    !normalized.startsWith('verpleegkunde/') ||
    normalized.includes('..') ||
    normalized.includes('logopedie')
  ) {
    return null;
  }
  if (!NURSING_MEDIA_EXT.has(extname(normalized).toLowerCase())) {
    return null;
  }
  const abs = resolve(resourcesRoot, normalized);
  const nursingRoot = resolve(resourcesRoot, 'verpleegkunde');
  if (abs !== nursingRoot && !abs.startsWith(nursingRoot + sep)) {
    return null;
  }
  return normalized;
}

function walkMediaFiles(
  dir: string,
  resourcesRoot: string,
  accept: (rel: string) => boolean,
): Array<{ relativePath: string; sizeBytes: number }> {
  if (!existsSync(dir)) {
    return [];
  }
  const items: Array<{ relativePath: string; sizeBytes: number }> = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      items.push(...walkMediaFiles(full, resourcesRoot, accept));
      continue;
    }
    const rel = relative(resourcesRoot, full).split(sep).join('/');
    if (accept(rel)) {
      items.push({ relativePath: rel, sizeBytes: statSync(full).size });
    }
  }
  return items.sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'nl'));
}

function walkLogopedieImages(
  dir: string,
  resourcesRoot: string,
): Array<{ relativePath: string; sizeBytes: number }> {
  return walkMediaFiles(dir, resourcesRoot, (rel) => Boolean(safeLogopedieRel(rel, resourcesRoot)));
}

function walkNursingMedia(
  dir: string,
  resourcesRoot: string,
): Array<{ relativePath: string; sizeBytes: number }> {
  return walkMediaFiles(dir, resourcesRoot, (rel) => Boolean(safeNursingRel(rel, resourcesRoot)));
}

function regenerateMediaManifest(projectRoot: string): void {
  spawnSync(process.execPath, [join(projectRoot, 'scripts', 'generate-media-manifest.mjs')], {
    cwd: projectRoot,
    stdio: 'ignore',
  });
}

function readRequestBody(req: IncomingMessage, limit: number): Promise<string> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('too-large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, payload: Record<string, unknown>): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function writeScenarioJson(target: string, pretty: string, makeBak: boolean): boolean {
  mkdirSync(dirname(target), { recursive: true });
  let backup = false;
  if (makeBak && existsSync(target)) {
    copyFileSync(target, `${target}.bak`);
    backup = true;
  }
  writeFileSync(target, pretty, 'utf8');
  return backup;
}

function isLogopedieEnvelope(data: unknown): boolean {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { schemaVersion?: unknown }).schemaVersion === 1 &&
    (data as { module?: unknown }).module === 'logopedie' &&
    typeof (data as { scenario?: unknown }).scenario === 'object' &&
    (data as { scenario?: unknown }).scenario !== null
  );
}

function isVerpleegkundeEnvelope(data: unknown): boolean {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { schemaVersion?: unknown }).schemaVersion === 1 &&
    (data as { module?: unknown }).module === 'verpleegkunde' &&
    typeof (data as { meta?: unknown }).meta === 'object' &&
    (data as { meta?: unknown }).meta !== null &&
    Array.isArray((data as { steps?: unknown }).steps) &&
    Array.isArray((data as { mediaSlots?: unknown }).mediaSlots)
  );
}

function editorSaveMiddleware(resourcesRoot: string, distResourcesRoot: string) {
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const moduleId = editorSaveModule(req.url);
    if (!moduleId) {
      next();
      return;
    }
    if (req.method !== 'POST') {
      sendJson(res, 405, { ok: false, error: 'Alleen POST is toegestaan.' });
      return;
    }
    void readRequestBody(req, MAX_EDITOR_BODY_BYTES)
      .then((body) => {
        let data: unknown;
        try {
          data = JSON.parse(body);
        } catch {
          sendJson(res, 400, { ok: false, error: 'Dit bestand is geen geldige JSON.' });
          return;
        }
        const valid =
          moduleId === 'logopedie' ? isLogopedieEnvelope(data) : isVerpleegkundeEnvelope(data);
        if (!valid) {
          sendJson(res, 400, {
            ok: false,
            error:
              moduleId === 'logopedie'
                ? 'Alleen een Logopedie-envelope met schemaVersion 1 kan worden opgeslagen.'
                : 'Alleen een Verpleegkunde-envelope met schemaVersion 1 kan worden opgeslagen.',
          });
          return;
        }
        const filename = moduleId === 'logopedie' ? 'logopedie.json' : 'verpleegkunde.json';
        const pretty = `${JSON.stringify(data, null, 2)}\n`;
        const target = join(resourcesRoot, 'scenarios', filename);
        const backup = writeScenarioJson(target, pretty, true);
        const distDir = join(distResourcesRoot, 'scenarios');
        if (existsSync(dirname(distResourcesRoot)) || existsSync(distResourcesRoot)) {
          writeScenarioJson(join(distDir, filename), pretty, false);
        }
        sendJson(res, 200, {
          ok: true,
          file: `resources/scenarios/${filename}`,
          backup,
        });
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.message === 'too-large') {
          sendJson(res, 413, { ok: false, error: 'Het JSON-bestand is te groot.' });
          return;
        }
        sendJson(res, 500, { ok: false, error: 'Opslaan is mislukt.' });
      });
  };
}

function editorMediaMiddleware(resourcesRoot: string, projectRoot: string) {
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!isEditorMediaPath(req.url)) {
      next();
      return;
    }
    const method = req.method ?? 'GET';
    if (method === 'GET') {
      sendJson(res, 200, {
        ok: true,
        items: walkLogopedieImages(join(resourcesRoot, 'logopedie'), resourcesRoot),
      });
      return;
    }
    if (method === 'DELETE') {
      const url = new URL(req.url ?? '', 'http://127.0.0.1');
      const rel = safeLogopedieRel(url.searchParams.get('path') ?? '', resourcesRoot);
      if (!rel) {
        sendJson(res, 400, {
          ok: false,
          error: 'Alleen bestanden onder resources/logopedie/ kunnen worden verwijderd.',
        });
        return;
      }
      const target = join(resourcesRoot, rel);
      if (existsSync(target)) {
        unlinkSync(target);
      }
      const distCopy = join(projectRoot, 'dist', 'resources', rel);
      if (existsSync(distCopy)) {
        unlinkSync(distCopy);
      }
      regenerateMediaManifest(projectRoot);
      sendJson(res, 200, { ok: true, file: `resources/${rel}` });
      return;
    }
    if (method !== 'POST') {
      sendJson(res, 405, { ok: false, error: 'GET, POST of DELETE is toegestaan.' });
      return;
    }
    void readRequestBody(req, MAX_EDITOR_BODY_BYTES)
      .then((body) => {
        let data: {
          relativePath?: unknown;
          replace?: unknown;
          replaceBasis?: unknown;
          contentBase64?: unknown;
        };
        try {
          data = JSON.parse(body) as typeof data;
        } catch {
          sendJson(res, 400, { ok: false, error: 'Media-JSON is ongeldig.' });
          return;
        }
        const rel = safeLogopedieRel(String(data.relativePath ?? ''), resourcesRoot);
        if (!rel) {
          sendJson(res, 400, {
            ok: false,
            error: 'Alleen afbeeldingen onder resources/logopedie/ kunnen worden opgeslagen.',
          });
          return;
        }
        if (typeof data.contentBase64 !== 'string' || data.contentBase64.length === 0) {
          sendJson(res, 400, { ok: false, error: 'Bestandsinhoud ontbreekt.' });
          return;
        }
        const target = join(resourcesRoot, rel);
        const exists = existsSync(target);
        if (exists && data.replace !== true) {
          sendJson(res, 409, { ok: false, error: 'Bestand bestaat al. Kies Vervangen.' });
          return;
        }
        if (rel === ERIK_BASIS_REL && exists && data.replaceBasis !== true) {
          sendJson(res, 403, {
            ok: false,
            error: 'erik_basis.png wordt niet overschreven tenzij je expres Vervangen kiest.',
          });
          return;
        }
        if (rel === ERIK_BASIS_REL && exists && data.replaceBasis === true) {
          copyFileSync(target, `${target}.bak`);
        } else if (exists) {
          copyFileSync(target, `${target}.bak`);
        }
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, Buffer.from(data.contentBase64, 'base64'));
        const distCopy = join(projectRoot, 'dist', 'resources', rel);
        if (existsSync(join(projectRoot, 'dist'))) {
          mkdirSync(dirname(distCopy), { recursive: true });
          writeFileSync(distCopy, Buffer.from(data.contentBase64, 'base64'));
        }
        regenerateMediaManifest(projectRoot);
        sendJson(res, 200, { ok: true, file: `resources/${rel}` });
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.message === 'too-large') {
          sendJson(res, 413, { ok: false, error: 'Het mediabestand is te groot.' });
          return;
        }
        sendJson(res, 500, { ok: false, error: 'Media opslaan is mislukt.' });
      });
  };
}

function editorNursingMediaMiddleware(resourcesRoot: string, projectRoot: string) {
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!isNursingEditorMediaPath(req.url)) {
      next();
      return;
    }
    const method = req.method ?? 'GET';
    if (method === 'GET') {
      sendJson(res, 200, {
        ok: true,
        items: walkNursingMedia(join(resourcesRoot, 'verpleegkunde'), resourcesRoot),
      });
      return;
    }
    if (method === 'DELETE') {
      const url = new URL(req.url ?? '', 'http://127.0.0.1');
      const rel = safeNursingRel(url.searchParams.get('path') ?? '', resourcesRoot);
      if (!rel) {
        sendJson(res, 400, {
          ok: false,
          error: 'Alleen bestanden onder resources/verpleegkunde/ kunnen worden verwijderd.',
        });
        return;
      }
      const target = join(resourcesRoot, rel);
      if (existsSync(target)) {
        unlinkSync(target);
      }
      const distCopy = join(projectRoot, 'dist', 'resources', rel);
      if (existsSync(distCopy)) {
        unlinkSync(distCopy);
      }
      regenerateMediaManifest(projectRoot);
      sendJson(res, 200, { ok: true, file: `resources/${rel}` });
      return;
    }
    if (method !== 'POST') {
      sendJson(res, 405, { ok: false, error: 'GET, POST of DELETE is toegestaan.' });
      return;
    }
    void readRequestBody(req, MAX_EDITOR_MEDIA_BYTES)
      .then((body) => {
        let data: {
          relativePath?: unknown;
          replace?: unknown;
          contentBase64?: unknown;
        };
        try {
          data = JSON.parse(body) as typeof data;
        } catch {
          sendJson(res, 400, { ok: false, error: 'Media-JSON is ongeldig.' });
          return;
        }
        const rel = safeNursingRel(String(data.relativePath ?? ''), resourcesRoot);
        if (!rel) {
          sendJson(res, 400, {
            ok: false,
            error: 'Alleen media onder resources/verpleegkunde/ kunnen worden opgeslagen.',
          });
          return;
        }
        if (typeof data.contentBase64 !== 'string' || data.contentBase64.length === 0) {
          sendJson(res, 400, { ok: false, error: 'Bestandsinhoud ontbreekt.' });
          return;
        }
        const target = join(resourcesRoot, rel);
        const exists = existsSync(target);
        if (exists && data.replace !== true) {
          sendJson(res, 409, { ok: false, error: 'Bestand bestaat al. Kies Vervangen.' });
          return;
        }
        if (exists) {
          copyFileSync(target, `${target}.bak`);
        }
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, Buffer.from(data.contentBase64, 'base64'));
        const distCopy = join(projectRoot, 'dist', 'resources', rel);
        if (existsSync(join(projectRoot, 'dist'))) {
          mkdirSync(dirname(distCopy), { recursive: true });
          writeFileSync(distCopy, Buffer.from(data.contentBase64, 'base64'));
        }
        regenerateMediaManifest(projectRoot);
        sendJson(res, 200, { ok: true, file: `resources/${rel}` });
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.message === 'too-large') {
          sendJson(res, 413, { ok: false, error: 'Het mediabestand is te groot.' });
          return;
        }
        sendJson(res, 500, { ok: false, error: 'Media opslaan is mislukt.' });
      });
  };
}

function stampPackageName(moduleId: string): string {
  return `${moduleId}-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
}

function collectZipEntries(dir: string, root = dir): ZipEntry[] {
  if (!existsSync(dir)) {
    return [];
  }
  const entries: ZipEntry[] = [];
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, item.name);
    if (item.isDirectory()) {
      entries.push(...collectZipEntries(full, root));
      continue;
    }
    if (item.name.endsWith('.bak')) {
      continue;
    }
    entries.push({
      name: relative(root, full).split(sep).join('/'),
      data: new Uint8Array(readFileSync(full)),
    });
  }
  return entries;
}

function copyModuleMedia(
  resourcesRoot: string,
  moduleId: 'logopedie' | 'verpleegkunde',
  target: string,
): void {
  const source = join(resourcesRoot, moduleId);
  if (!existsSync(source)) {
    mkdirSync(target, { recursive: true });
    return;
  }
  mkdirSync(target, { recursive: true });
  cpSync(source, target, {
    recursive: true,
    filter: (src) => !src.endsWith('.bak'),
  });
}

function editorPackageMiddleware(resourcesRoot: string, projectRoot: string) {
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (isEditorExportFilePath(req.url)) {
      if (req.method !== 'GET') {
        sendJson(res, 405, { ok: false, error: 'Alleen GET is toegestaan.' });
        return;
      }
      const url = new URL(req.url ?? '', 'http://127.0.0.1');
      const rel = (url.searchParams.get('path') ?? '').replaceAll('\\', '/').replace(/^\/+/, '');
      if (
        !rel.startsWith('exports/') ||
        rel.includes('..') ||
        !rel.toLowerCase().endsWith('.zip')
      ) {
        sendJson(res, 400, {
          ok: false,
          error: 'Alleen zip-bestanden in exports/ zijn toegestaan.',
        });
        return;
      }
      const abs = resolve(projectRoot, rel);
      const root = resolve(projectRoot, 'exports');
      if (abs === root || !abs.startsWith(root + sep) || !existsSync(abs)) {
        sendJson(res, 404, { ok: false, error: 'Exportbestand niet gevonden.' });
        return;
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${basename(abs)}"`);
      res.setHeader('Cache-Control', 'no-store');
      createReadStream(abs).pipe(res);
      return;
    }
    if (isEditorExportPath(req.url)) {
      if (req.method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'Alleen POST is toegestaan.' });
        return;
      }
      void readRequestBody(req, MAX_EDITOR_PACKAGE_BYTES)
        .then((body) => {
          let data: {
            module?: unknown;
            envelopeText?: unknown;
            extraMedia?: Array<{ relativePath?: unknown; contentBase64?: unknown }>;
          };
          try {
            data = JSON.parse(body) as typeof data;
          } catch {
            sendJson(res, 400, { ok: false, error: 'Export-JSON is ongeldig.' });
            return;
          }
          const moduleId =
            data.module === 'logopedie' || data.module === 'verpleegkunde' ? data.module : null;
          if (!moduleId || typeof data.envelopeText !== 'string') {
            return sendJson(res, 400, {
              ok: false,
              error: 'module en envelopeText zijn verplicht.',
            });
          }
          let envelope: { module?: unknown };
          try {
            envelope = JSON.parse(data.envelopeText) as { module?: unknown };
          } catch {
            sendJson(res, 400, { ok: false, error: 'envelopeText is geen geldige JSON.' });
            return;
          }
          if (envelope.module !== moduleId) {
            sendJson(res, 400, { ok: false, error: 'De envelope hoort niet bij deze module.' });
            return;
          }
          const name = stampPackageName(moduleId);
          const outDir = join(projectRoot, 'exports', name);
          mkdirSync(join(outDir, 'media', moduleId), { recursive: true });
          writeFileSync(
            join(outDir, 'holobox-package.json'),
            `${JSON.stringify(
              {
                schemaVersion: 1,
                kind: 'holobox-editor-package',
                module: moduleId,
                exportedAt: new Date().toISOString(),
              },
              null,
              2,
            )}\n`,
            'utf8',
          );
          writeFileSync(
            join(outDir, `${moduleId}.json`),
            data.envelopeText.endsWith('\n') ? data.envelopeText : `${data.envelopeText}\n`,
            'utf8',
          );
          copyModuleMedia(resourcesRoot, moduleId, join(outDir, 'media', moduleId));
          for (const item of data.extraMedia ?? []) {
            const rel =
              moduleId === 'logopedie'
                ? safeLogopedieRel(String(item.relativePath ?? ''), resourcesRoot)
                : safeNursingRel(String(item.relativePath ?? ''), resourcesRoot);
            if (!rel || typeof item.contentBase64 !== 'string') {
              sendJson(res, 400, {
                ok: false,
                error: 'Extra media in het pakket liggen buiten de modulemap.',
              });
              return;
            }
            const dest = join(outDir, 'media', rel);
            mkdirSync(dirname(dest), { recursive: true });
            writeFileSync(dest, Buffer.from(item.contentBase64, 'base64'));
          }
          const zipPath = join(projectRoot, 'exports', `${name}.zip`);
          writeFileSync(zipPath, Buffer.from(zipStore(collectZipEntries(outDir))));
          sendJson(res, 200, {
            ok: true,
            folder: `exports/${name}`,
            zip: `exports/${name}.zip`,
          });
        })
        .catch((error: unknown) => {
          if (error instanceof Error && error.message === 'too-large') {
            sendJson(res, 413, { ok: false, error: 'Het exportpakket is te groot.' });
            return;
          }
          sendJson(res, 500, { ok: false, error: 'Exporteren is mislukt.' });
        });
      return;
    }
    if (!isEditorImportMediaPath(req.url)) {
      next();
      return;
    }
    if (req.method !== 'POST') {
      sendJson(res, 405, { ok: false, error: 'Alleen POST is toegestaan.' });
      return;
    }
    void readRequestBody(req, MAX_EDITOR_PACKAGE_BYTES)
      .then((body) => {
        let data: {
          module?: unknown;
          files?: Array<{ relativePath?: unknown; contentBase64?: unknown }>;
        };
        try {
          data = JSON.parse(body) as typeof data;
        } catch {
          sendJson(res, 400, { ok: false, error: 'Import-JSON is ongeldig.' });
          return;
        }
        const moduleId =
          data.module === 'logopedie' || data.module === 'verpleegkunde' ? data.module : null;
        if (!moduleId || !Array.isArray(data.files)) {
          sendJson(res, 400, { ok: false, error: 'module en files zijn verplicht.' });
          return;
        }
        const written: string[] = [];
        for (const item of data.files) {
          const rel =
            moduleId === 'logopedie'
              ? safeLogopedieRel(String(item.relativePath ?? ''), resourcesRoot)
              : safeNursingRel(String(item.relativePath ?? ''), resourcesRoot);
          if (!rel || typeof item.contentBase64 !== 'string' || item.contentBase64.length === 0) {
            sendJson(res, 400, {
              ok: false,
              error: 'Een mediabestand in het pakket is ongeldig of ligt buiten de modulemap.',
            });
            return;
          }
          const target = join(resourcesRoot, rel);
          if (existsSync(target)) {
            copyFileSync(target, `${target}.bak`);
          }
          mkdirSync(dirname(target), { recursive: true });
          writeFileSync(target, Buffer.from(item.contentBase64, 'base64'));
          const distCopy = join(projectRoot, 'dist', 'resources', rel);
          if (existsSync(join(projectRoot, 'dist'))) {
            mkdirSync(dirname(distCopy), { recursive: true });
            writeFileSync(distCopy, Buffer.from(item.contentBase64, 'base64'));
          }
          written.push(rel);
        }
        regenerateMediaManifest(projectRoot);
        sendJson(res, 200, { ok: true, files: written });
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.message === 'too-large') {
          sendJson(res, 413, { ok: false, error: 'Het importpakket is te groot.' });
          return;
        }
        sendJson(res, 500, { ok: false, error: 'Importeren van media is mislukt.' });
      });
  };
}

function envelopeSummary(
  text: string,
  moduleId: 'logopedie' | 'verpleegkunde',
): { title: string; summary: string } | null {
  try {
    const data = JSON.parse(text) as {
      module?: unknown;
      scenario?: { title?: unknown; client?: { name?: unknown } };
      meta?: { title?: unknown };
      patient?: { name?: unknown; background?: unknown };
    };
    if (data.module !== moduleId) {
      return null;
    }
    if (moduleId === 'logopedie') {
      const title =
        typeof data.scenario?.title === 'string' ? data.scenario.title : 'Logopedie-scenario';
      const name =
        typeof data.scenario?.client?.name === 'string'
          ? data.scenario.client.name
          : 'fictieve cliënt';
      return { title, summary: `Opgeslagen casus met ${name}.` };
    }
    const title = typeof data.meta?.title === 'string' ? data.meta.title : 'Verpleegkunde-scenario';
    const name = typeof data.patient?.name === 'string' ? data.patient.name : 'fictieve patiënt';
    return { title, summary: `Opgeslagen casus met ${name}.` };
  } catch {
    return null;
  }
}

function envelopeFromZip(zipPath: string, moduleId: 'logopedie' | 'verpleegkunde'): string | null {
  try {
    const entries = unzipStore(new Uint8Array(readFileSync(zipPath)));
    const wanted = `${moduleId}.json`;
    const entry = entries.find((item) => item.name.replaceAll('\\', '/') === wanted);
    return entry ? new TextDecoder().decode(entry.data) : null;
  } catch {
    return null;
  }
}

function listExtraScenarioTiles(
  moduleId: 'logopedie' | 'verpleegkunde',
  resourcesRoot: string,
  projectRoot: string,
): Array<{ id: string; title: string; summary: string; module: string; source: 'file' }> {
  const tiles: Array<{
    id: string;
    title: string;
    summary: string;
    module: string;
    source: 'file';
  }> = [];
  const skip = `${moduleId}.json`;
  const scenariosDir = join(resourcesRoot, 'scenarios');
  if (existsSync(scenariosDir)) {
    for (const name of readdirSync(scenariosDir)) {
      if (!name.endsWith('.json') || name.endsWith('.bak') || name === skip) {
        continue;
      }
      try {
        const text = readFileSync(join(scenariosDir, name), 'utf8');
        const info = envelopeSummary(text, moduleId);
        if (info) {
          tiles.push({
            id: `scenarios/${name}`,
            title: info.title,
            summary: info.summary,
            module: moduleId,
            source: 'file',
          });
        }
      } catch {
        // skip unreadable files
      }
    }
  }
  const exportsDir = join(projectRoot, 'exports');
  if (!existsSync(exportsDir)) {
    return tiles;
  }
  for (const name of readdirSync(exportsDir)) {
    const full = join(exportsDir, name);
    try {
      if (name.endsWith('.zip')) {
        const text = envelopeFromZip(full, moduleId);
        const info = text ? envelopeSummary(text, moduleId) : null;
        if (info) {
          tiles.push({
            id: `exports/${name}`,
            title: info.title,
            summary: info.summary,
            module: moduleId,
            source: 'file',
          });
        }
        continue;
      }
      if (!statSync(full).isDirectory()) {
        continue;
      }
      const jsonPath = join(full, `${moduleId}.json`);
      if (!existsSync(jsonPath)) {
        continue;
      }
      const info = envelopeSummary(readFileSync(jsonPath, 'utf8'), moduleId);
      if (info) {
        tiles.push({
          id: `exports/${name}/${moduleId}.json`,
          title: info.title,
          summary: info.summary,
          module: moduleId,
          source: 'file',
        });
      }
    } catch {
      // skip broken exports
    }
  }
  return tiles;
}

function resolveCatalogFile(
  id: string,
  resourcesRoot: string,
  projectRoot: string,
): { type: 'json'; path: string } | { type: 'zip'; path: string } | null {
  const normalized = id.replaceAll('\\', '/').replace(/^\/+/, '');
  if (normalized.includes('..')) {
    return null;
  }
  if (normalized.startsWith('scenarios/') && normalized.endsWith('.json')) {
    const abs = resolve(resourcesRoot, normalized);
    const root = resolve(resourcesRoot, 'scenarios');
    if (abs === root || !abs.startsWith(root + sep) || !existsSync(abs)) {
      return null;
    }
    return { type: 'json', path: abs };
  }
  if (normalized.startsWith('exports/') && normalized.endsWith('.zip')) {
    const abs = resolve(projectRoot, normalized);
    const root = resolve(projectRoot, 'exports');
    if (abs === root || !abs.startsWith(root + sep) || !existsSync(abs)) {
      return null;
    }
    return { type: 'zip', path: abs };
  }
  if (normalized.startsWith('exports/') && normalized.endsWith('.json')) {
    const abs = resolve(projectRoot, normalized);
    const root = resolve(projectRoot, 'exports');
    if (abs === root || !abs.startsWith(root + sep) || !existsSync(abs)) {
      return null;
    }
    return { type: 'json', path: abs };
  }
  return null;
}

function scenarioCatalogMiddleware(resourcesRoot: string, projectRoot: string) {
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (isScenarioTilesPath(req.url)) {
      const url = new URL(req.url ?? '', 'http://127.0.0.1');
      const moduleId = url.searchParams.get('module');
      if (moduleId !== 'logopedie' && moduleId !== 'verpleegkunde') {
        sendJson(res, 400, { ok: false, tiles: [] });
        return;
      }
      sendJson(res, 200, {
        ok: true,
        tiles: listExtraScenarioTiles(moduleId, resourcesRoot, projectRoot),
      });
      return;
    }
    if (!isScenarioEnvelopePath(req.url)) {
      next();
      return;
    }
    const url = new URL(req.url ?? '', 'http://127.0.0.1');
    const moduleId = url.searchParams.get('module');
    const id = url.searchParams.get('id') ?? '';
    if (moduleId !== 'logopedie' && moduleId !== 'verpleegkunde') {
      sendJson(res, 400, { ok: false, error: 'Onbekende module.' });
      return;
    }
    const target = resolveCatalogFile(id, resourcesRoot, projectRoot);
    if (!target) {
      sendJson(res, 404, { ok: false, error: 'Scenario niet gevonden.' });
      return;
    }
    const text =
      target.type === 'zip'
        ? envelopeFromZip(target.path, moduleId)
        : existsSync(target.path)
          ? readFileSync(target.path, 'utf8')
          : null;
    if (!text) {
      sendJson(res, 404, { ok: false, error: 'Scenario niet gevonden.' });
      return;
    }
    sendJson(res, 200, { ok: true, envelopeText: text });
  };
}

function resourcesPlugin(): Plugin {
  const resourcesRoot = resolve(fileURLToPath(new URL('./resources', import.meta.url)));
  const distResourcesRoot = resolve(fileURLToPath(new URL('./dist/resources', import.meta.url)));
  const types: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.m4v': 'video/x-m4v',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.svg': 'image/svg+xml',
    '.json': 'application/json',
  };
  function serveResources(req: IncomingMessage, res: ServerResponse, next: () => void) {
    const path = requestPath(req.url);
    const marker = '/resources/';
    const index = path.indexOf(marker);
    if (index < 0) {
      next();
      return;
    }
    const rel = path.slice(index + marker.length);
    const file = resolve(resourcesRoot, rel);
    if (!file.startsWith(resourcesRoot) || !existsSync(file)) {
      next();
      return;
    }
    const ext = extname(file).toLowerCase();
    res.setHeader('Content-Type', types[ext] ?? 'application/octet-stream');
    res.setHeader('Content-Length', String(statSync(file).size));
    res.setHeader('Cache-Control', ext === '.json' ? 'no-store' : 'no-cache');
    createReadStream(file).pipe(res);
  }

  return {
    name: 'holobox-resources',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        rewriteLegacyBase(req);
        next();
      });
      server.middlewares.use(editorSaveMiddleware(resourcesRoot, distResourcesRoot));
      server.middlewares.use(editorMediaMiddleware(resourcesRoot, resolve(resourcesRoot, '..')));
      server.middlewares.use(
        editorNursingMediaMiddleware(resourcesRoot, resolve(resourcesRoot, '..')),
      );
      server.middlewares.use(editorPackageMiddleware(resourcesRoot, resolve(resourcesRoot, '..')));
      server.middlewares.use(
        scenarioCatalogMiddleware(resourcesRoot, resolve(resourcesRoot, '..')),
      );
      server.middlewares.use(serveResources);
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        rewriteLegacyBase(req);
        next();
      });
      server.middlewares.use(editorSaveMiddleware(resourcesRoot, distResourcesRoot));
      server.middlewares.use(editorMediaMiddleware(resourcesRoot, resolve(resourcesRoot, '..')));
      server.middlewares.use(
        editorNursingMediaMiddleware(resourcesRoot, resolve(resourcesRoot, '..')),
      );
      server.middlewares.use(editorPackageMiddleware(resourcesRoot, resolve(resourcesRoot, '..')));
      server.middlewares.use(
        scenarioCatalogMiddleware(resourcesRoot, resolve(resourcesRoot, '..')),
      );
      server.middlewares.use(serveResources);
      server.middlewares.use((req, res, next) => {
        const path = req.url ?? '';
        if (
          path === '/' ||
          path.startsWith('/index.html') ||
          path.startsWith('/editor.html') ||
          path.startsWith('/assets/') ||
          path.startsWith('/logopedie') ||
          path.startsWith('/verpleegkunde')
        ) {
          res.setHeader('Cache-Control', 'no-store');
        }
        next();
      });
    },
    closeBundle() {
      if (existsSync(resourcesRoot)) {
        cpSync(resourcesRoot, join('dist', 'resources'), { recursive: true });
      }
      const indexHtml = join('dist', 'index.html');
      if (existsSync(indexHtml)) {
        cpSync(indexHtml, join('dist', '404.html'));
      }
    },
  };
}

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  base: APP_BASE,
  plugins: [react(), resourcesPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: join(projectRoot, 'index.html'),
        editor: join(projectRoot, 'editor.html'),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: '127.0.0.1',
  },
  preview: {
    port: 4173,
    strictPort: true,
    host: '127.0.0.1',
  },
});
