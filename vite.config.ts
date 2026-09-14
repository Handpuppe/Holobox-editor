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
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string };

const MAX_EDITOR_BODY_BYTES = 8_000_000;

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

function isEditorSavePath(url: string | undefined): boolean {
  const path = requestPath(url);
  return path === '/editor-api/save-logopedie' || path.endsWith('/editor-api/save-logopedie');
}

function isEditorMediaPath(url: string | undefined): boolean {
  const path = requestPath(url);
  return path === '/editor-api/logopedie-media' || path.includes('/editor-api/logopedie-media');
}

const LOGOPEDIE_IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif']);
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

function walkLogopedieImages(
  dir: string,
  resourcesRoot: string,
): Array<{ relativePath: string; sizeBytes: number }> {
  if (!existsSync(dir)) {
    return [];
  }
  const items: Array<{ relativePath: string; sizeBytes: number }> = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      items.push(...walkLogopedieImages(full, resourcesRoot));
      continue;
    }
    const rel = relative(resourcesRoot, full).split(sep).join('/');
    if (safeLogopedieRel(rel, resourcesRoot)) {
      items.push({ relativePath: rel, sizeBytes: statSync(full).size });
    }
  }
  return items.sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'nl'));
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

function writeLogopedieJson(target: string, pretty: string, makeBak: boolean): boolean {
  mkdirSync(dirname(target), { recursive: true });
  let backup = false;
  if (makeBak && existsSync(target)) {
    copyFileSync(target, `${target}.bak`);
    backup = true;
  }
  writeFileSync(target, pretty, 'utf8');
  return backup;
}

function editorSaveMiddleware(resourcesRoot: string, distResourcesRoot: string) {
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!isEditorSavePath(req.url)) {
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
        if (
          typeof data !== 'object' ||
          data === null ||
          (data as { schemaVersion?: unknown }).schemaVersion !== 1 ||
          (data as { module?: unknown }).module !== 'logopedie' ||
          typeof (data as { scenario?: unknown }).scenario !== 'object' ||
          (data as { scenario?: unknown }).scenario === null
        ) {
          sendJson(res, 400, {
            ok: false,
            error: 'Alleen een Logopedie-envelope met schemaVersion 1 kan worden opgeslagen.',
          });
          return;
        }
        const pretty = `${JSON.stringify(data, null, 2)}\n`;
        const target = join(resourcesRoot, 'scenarios', 'logopedie.json');
        const backup = writeLogopedieJson(target, pretty, true);
        const distDir = join(distResourcesRoot, 'scenarios');
        if (existsSync(dirname(distResourcesRoot)) || existsSync(distResourcesRoot)) {
          writeLogopedieJson(join(distDir, 'logopedie.json'), pretty, false);
        }
        sendJson(res, 200, {
          ok: true,
          file: 'resources/scenarios/logopedie.json',
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
      server.middlewares.use(serveResources);
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        rewriteLegacyBase(req);
        next();
      });
      server.middlewares.use(editorSaveMiddleware(resourcesRoot, distResourcesRoot));
      server.middlewares.use(editorMediaMiddleware(resourcesRoot, resolve(resourcesRoot, '..')));
      server.middlewares.use(serveResources);
      server.middlewares.use((req, res, next) => {
        const path = req.url ?? '';
        if (
          path === '/' ||
          path.startsWith('/index.html') ||
          path.startsWith('/editor.html') ||
          path.startsWith('/assets/') ||
          path.startsWith('/logopedie')
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
