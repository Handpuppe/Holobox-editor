import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist');
const editor = join(dist, 'editor.html');
if (!existsSync(editor)) {
  process.stderr.write('dist/editor.html ontbreekt. Draai eerst npm run build.\n');
  process.exit(1);
}

copyFileSync(editor, join(dist, 'index.html'));
copyFileSync(editor, join(dist, '404.html'));
writeFileSync(join(dist, '.nojekyll'), '');
process.stdout.write('Pages-site: / en 404 tonen de editor (geen studentenhub).\n');
