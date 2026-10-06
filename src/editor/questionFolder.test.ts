import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { emptyNursingScenario } from './emptyScenario';
import { appendNursingStep } from './nursingSteps';
import {
  QUESTION_TEXT_FILES,
  questionFolderRelative,
  questionTextFiles,
  questionVideoRelative,
  startVideoRelative,
} from './questionFolder';
import {
  removeQuestionFolder,
  restoreQuestionFolderBackup,
  writeQuestionFolderFiles,
} from './questionFolderWrite';

describe('question folders', () => {
  it('names a case question folder and keeps an existing video where it is', () => {
    expect(questionFolderRelative('verpleegkunde', 'Slechtnieuwsgesprek', 'Vraag.1')).toBe(
      'gesprekstechnieken/Slechtnieuwsgesprek-Vraag1',
    );
    expect(questionFolderRelative('verpleegkunde', 'Slechtnieuwsgesprek oefenen', 'Vraag.3')).toBe(
      'gesprekstechnieken/Slechtnieuwsgesprek oefenen-Vraag3',
    );
    expect(questionFolderRelative('logopedie', 'Slechtnieuwsgesprek', 'Vraag.1')).toBe(
      'logopedie/Slechtnieuwsgesprek-Vraag1',
    );
    expect(questionVideoRelative('verpleegkunde/Slechtnieuwsgesprek-Vraag1', 'start')).toBe(
      'gesprekstechnieken/Slechtnieuwsgesprek-Vraag1/Videos/vraag-startvideo.mp4',
    );
    expect(questionVideoRelative('gesprekstechnieken/Slechtnieuwsgesprek-Vraag1', 'high')).toBe(
      'gesprekstechnieken/Slechtnieuwsgesprek-Vraag1/Videos/antwoord-goed.mp4',
    );
    expect(questionVideoRelative('verpleegkunde/Slechtnieuwsgesprek-Vraag1', 'high-extra')).toBe(
      'gesprekstechnieken/Slechtnieuwsgesprek-Vraag1/Videos/antwoord-goed-extra.mp4',
    );
    expect(questionVideoRelative('logopedie/Slechtnieuwsgesprek-Vraag1', 'start')).toBeNull();
    expect(startVideoRelative('Slechtnieuwsgesprek oefenen', 'Vraag.3')).toBe(
      'gesprekstechnieken/Startvideos/Slechtnieuwsgesprek-oefenen-Vraag3-startvideo.mp4',
    );
    expect(startVideoRelative('Slechtnieuwsgesprek', 'Vraag.2')).toBe(
      'gesprekstechnieken/Startvideos/Slechtnieuwsgesprek-Vraag2-startvideo.mp4',
    );
    expect(startVideoRelative('../logopedie', 'Vraag.1')).toBeNull();
    expect(
      questionVideoRelative('verpleegkunde/../Slechtnieuwsgesprek-Vraag1', 'start'),
    ).toBeNull();

    const root = join(tmpdir(), `vraagmap-${Date.now()}`);
    const kept = join(root, 'gesprekstechnieken', 'oud.mp4');
    mkdirSync(join(root, 'gesprekstechnieken'), { recursive: true });
    writeFileSync(kept, 'bestaand', 'utf8');
    const folder = 'gesprekstechnieken/Slechtnieuwsgesprek-Vraag1';
    const files = {
      'vraag-startvideo.txt': 'Start van de vraag',
      'antwoord-goed.txt': 'Goed spelen',
      'antwoord-deels-goed.txt': 'Deels spelen',
      'antwoord-verkeerd.txt': 'Fout spelen',
      'antwoord-goed-extra.txt': 'Extra goed',
      'antwoord-deels-goed-extra.txt': 'Extra deels',
      'antwoord-verkeerd-extra.txt': 'Extra fout',
    };
    expect(
      writeQuestionFolderFiles(root, 'verpleegkunde/Slechtnieuwsgesprek-Vraag1', files),
    ).toEqual({ ok: true });
    expect(existsSync(join(root, folder, 'Videos'))).toBe(true);
    for (const name of QUESTION_TEXT_FILES) {
      expect(readFileSync(join(root, folder, name), 'utf8')).toBe(files[name]);
    }
    const video = join(root, folder, 'Videos', 'antwoord-goed.mp4');
    writeFileSync(video, 'beeld', 'utf8');
    expect(readFileSync(kept, 'utf8')).toBe('bestaand');
    expect(existsSync(join(root, folder, 'Videos', 'oud.mp4'))).toBe(false);
    expect(writeQuestionFolderFiles(root, 'verpleegkunde/../elders-Vraag1', files).ok).toBe(false);

    const removed = removeQuestionFolder(root, folder);
    expect(removed.ok).toBe(true);
    expect(existsSync(join(root, folder))).toBe(false);
    expect(readFileSync(kept, 'utf8')).toBe('bestaand');
    if (!removed.ok) {
      return;
    }
    expect(restoreQuestionFolderBackup(root, folder, removed.files).ok).toBe(true);
    expect(readFileSync(join(root, folder, 'vraag-startvideo.txt'), 'utf8')).toBe(
      'Start van de vraag',
    );
    expect(readFileSync(video, 'utf8')).toBe('beeld');
    expect(readFileSync(kept, 'utf8')).toBe('bestaand');
  });

  it('stores the play and optional texts for a new question', () => {
    const draft = emptyNursingScenario();
    draft.meta.title = 'Slechtnieuwsgesprek';
    const added = appendNursingStep(draft).step;
    added.stepVideoPlaceholder = 'Start';
    added.options[0].videoPlaceholder = 'Goed spelen';
    added.options[0].answerCardPlaceholder = 'Extra goed';
    const files = questionTextFiles(added);
    expect(added.questionFolder).toBe('gesprekstechnieken/Slechtnieuwsgesprek-Vraag2');
    expect(files['vraag-startvideo.txt']).toBe('Start');
    expect(files['antwoord-goed.txt']).toBe('Goed spelen');
    expect(files['antwoord-goed-extra.txt']).toBe('Extra goed');
  });
});
