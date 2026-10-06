import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deleteEditorCase } from './caseDelete';

describe('deleteEditorCase', () => {
  it('removes the case json and its question folder, and leaves other files', () => {
    const root = join(tmpdir(), `holobox-case-delete-${Date.now()}`);
    const folder = join(root, 'gesprekstechnieken', 'Tijdelijke casus-Vraag2');
    const otherFolder = join(root, 'gesprekstechnieken', 'Andere casus-Vraag1');
    mkdirSync(join(folder, 'Videos'), { recursive: true });
    mkdirSync(join(otherFolder, 'Videos'), { recursive: true });
    writeFileSync(join(folder, 'vraag-startvideo.txt'), 'tekst', 'utf8');
    writeFileSync(join(folder, 'Videos', 'antwoord-goed.mp4'), 'beeld', 'utf8');
    writeFileSync(join(otherFolder, 'vraag-startvideo.txt'), 'bewaren', 'utf8');
    writeFileSync(join(root, 'gesprekstechnieken', 'oud.mp4'), 'catalogus', 'utf8');
    mkdirSync(join(root, 'scenarios'), { recursive: true });
    const fileName = 'verpleegkunde-tijdelijk.json';
    const target = join(root, 'scenarios', fileName);
    writeFileSync(
      target,
      `${JSON.stringify({
        module: 'verpleegkunde',
        steps: [{ questionFolder: 'gesprekstechnieken/Tijdelijke casus-Vraag2' }],
      })}\n`,
      'utf8',
    );
    writeFileSync(`${target}.bak`, 'oud', 'utf8');
    const kept = join(root, 'scenarios', 'verpleegkunde-bewaren.json');
    writeFileSync(kept, '{"module":"verpleegkunde"}\n', 'utf8');

    const removed = deleteEditorCase(root, 'verpleegkunde', fileName, [
      'gesprekstechnieken/Tijdelijke casus-Vraag2',
      'gesprekstechnieken/oud.mp4',
    ]);

    expect(removed.ok).toBe(true);
    expect(existsSync(target)).toBe(false);
    expect(existsSync(`${target}.bak`)).toBe(false);
    expect(existsSync(folder)).toBe(false);
    expect(existsSync(join(otherFolder, 'vraag-startvideo.txt'))).toBe(true);
    expect(readFileSync(join(root, 'gesprekstechnieken', 'oud.mp4'), 'utf8')).toBe('catalogus');
    expect(existsSync(kept)).toBe(true);

    const refused = deleteEditorCase(root, 'verpleegkunde', '../verpleegkunde.json', []);
    expect(refused.ok).toBe(false);
    expect(existsSync(kept)).toBe(true);
  });

  it('removes question folders named in the json when the list sends none', () => {
    const root = join(tmpdir(), `holobox-case-delete-list-${Date.now()}`);
    const folder = join(root, 'gesprekstechnieken', 'ABCDE voorbeeld-Vraag1');
    const keptFolder = join(root, 'gesprekstechnieken', 'Slechtnieuwsgesprek oefenen-Vraag3');
    mkdirSync(join(folder, 'Videos'), { recursive: true });
    mkdirSync(keptFolder, { recursive: true });
    writeFileSync(join(folder, 'vraag-startvideo.txt'), 'weg', 'utf8');
    writeFileSync(join(keptFolder, 'vraag-startvideo.txt'), 'blijft', 'utf8');
    mkdirSync(join(root, 'scenarios'), { recursive: true });
    const fileName = 'verpleegkunde-abcde-lijst.json';
    const target = join(root, 'scenarios', fileName);
    writeFileSync(
      target,
      `${JSON.stringify({
        module: 'verpleegkunde',
        steps: [{ questionFolder: 'gesprekstechnieken/ABCDE voorbeeld-Vraag1' }],
      })}\n`,
      'utf8',
    );

    const removed = deleteEditorCase(root, 'verpleegkunde', fileName, []);

    expect(removed.ok).toBe(true);
    expect(existsSync(target)).toBe(false);
    expect(existsSync(folder)).toBe(false);
    expect(readFileSync(join(keptFolder, 'vraag-startvideo.txt'), 'utf8')).toBe('blijft');
  });
});
