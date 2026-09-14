import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist');
const editor = join(dist, 'editor.html');
const assets = join(dist, 'assets');

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function assertBuiltEditorHtml(file) {
  if (!existsSync(file)) {
    fail(`${file} ontbreekt.`);
  }
  const html = readFileSync(file, 'utf8');
  if (html.includes('/src/') || html.includes('.tsx')) {
    fail(
      `${file} is bron-HTML (bevat /src/ of .tsx). Pages zou wit worden. Publiceer alleen dist/ na npm run build.`,
    );
  }
  if (!html.includes('/Holobox-editor/assets/')) {
    fail(`${file} wijst niet naar /Holobox-editor/assets/*.js.`);
  }
  if (!html.includes('class="editor-page"')) {
    fail(`${file} is niet de editor (mist class="editor-page").`);
  }
}

if (!existsSync(editor)) {
  fail('dist/editor.html ontbreekt. Draai eerst npm run build.');
}
if (!existsSync(assets) || readdirSync(assets).length === 0) {
  fail('dist/assets ontbreekt of is leeg. De build is niet gelukt.');
}

copyFileSync(editor, join(dist, 'index.html'));
copyFileSync(editor, join(dist, '404.html'));
writeFileSync(join(dist, '.nojekyll'), '');

assertBuiltEditorHtml(join(dist, 'index.html'));
assertBuiltEditorHtml(join(dist, 'editor.html'));
assertBuiltEditorHtml(join(dist, '404.html'));

process.stdout.write('Pages-site: / en 404 tonen de gebouwde editor (geen /src/*.tsx, geen hub).\n');
