import { createReadStream, cpSync, existsSync, readFileSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string };

function resourcesPlugin(): Plugin {
  const resourcesRoot = resolve(fileURLToPath(new URL('./resources', import.meta.url)));
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
  };
  function serveResources(req: IncomingMessage, res: ServerResponse, next: () => void) {
    const rel = decodeURIComponent((req.url ?? '').split('?')[0] ?? '').replace(/^\/+/, '');
    const file = resolve(resourcesRoot, rel);
    if (!file.startsWith(resourcesRoot) || !existsSync(file)) {
      next();
      return;
    }
    const ext = extname(file).toLowerCase();
    res.setHeader('Content-Type', types[ext] ?? 'application/octet-stream');
    res.setHeader('Content-Length', String(statSync(file).size));
    res.setHeader('Cache-Control', 'no-cache');
    createReadStream(file).pipe(res);
  }

  return {
    name: 'holobox-resources',
    configureServer(server) {
      server.middlewares.use('/resources', serveResources);
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url ?? '';
        if (
          path === '/' ||
          path.startsWith('/index.html') ||
          path.startsWith('/assets/') ||
          path.startsWith('/logopedie')
        ) {
          res.setHeader('Cache-Control', 'no-store');
        }
        next();
      });
      server.middlewares.use('/resources', serveResources);
    },
    closeBundle() {
      if (existsSync(resourcesRoot)) {
        cpSync(resourcesRoot, join('dist', 'resources'), { recursive: true });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), resourcesPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
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
