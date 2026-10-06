import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nursingNodeOverview } from './nodeBoard';
import { parseVerpleegkundeEnvelope } from './nursingEnvelope';

const caseFile = join('resources', 'scenarios', 'verpleegkunde.json');

describe('Slechtnieuwsgesprek oefenen', () => {
  it('keeps ten HBO questions, existing positions, and the wrong-answer line', () => {
    const parsed = parseVerpleegkundeEnvelope(readFileSync(caseFile, 'utf8'));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const { scenario } = parsed;
    expect(scenario.meta.title).toBe('Slechtnieuwsgesprek oefenen');
    expect(scenario.steps).toHaveLength(10);
    expect(scenario.nodeLayout?.['q:n-1']).toEqual({ x: 168, y: 0 });
    expect(scenario.nodeLayout?.['a:n-extra-1:inappropriate']?.x).toBeCloseTo(1514.6669311523438);
    expect(
      scenario.steps[0]?.options.find((option) => option.quality === 'inappropriate')?.text,
    ).toBe('Als u de feiten op een rij zet, wordt de onrust vanzelf minder.');

    const model = nursingNodeOverview(scenario);
    expect(model.rows.map((row) => row.title)).toEqual([
      'Vraag.1',
      'Vraag.2',
      'Vraag.3',
      'Vraag.4',
      'Vraag.5',
      'Vraag.6',
      'Vraag.7',
      'Vraag.8',
      'Vraag.9',
      'Vraag.10',
    ]);
    for (const [index, step] of scenario.steps.entries()) {
      const next = scenario.steps[index + 1]?.id ?? null;
      expect(step.options.find((option) => option.quality === 'high')?.nextStepId).toBe(
        next ?? 'completed',
      );
      expect(step.options.find((option) => option.quality === 'partial')?.nextStepId).toBe(
        next ?? 'completed',
      );
      expect(step.options.find((option) => option.quality === 'inappropriate')?.nextStepId).toBe(
        step.id,
      );
      expect(step.stepVideoPlaceholder?.trim().length).toBeGreaterThan(0);
      for (const option of step.options) {
        expect(option.videoPlaceholder?.trim().length).toBeGreaterThan(0);
        expect(option.text).not.toMatch(/[“”"]/);
      }
    }
    const vraag3 = scenario.steps[2];
    expect(
      model.wires.some(
        (wire) =>
          wire.from === `a-out-${vraag3?.id}-inappropriate` && wire.to === `q-in-${vraag3?.id}`,
      ),
    ).toBe(true);
    expect(
      model.wires.some(
        (wire) => wire.from.startsWith('a-out-n-extra-9-') && wire.to !== 'q-in-n-extra-9',
      ),
    ).toBe(false);
    expect(vraag3?.stepVideoPlaceholder).not.toMatch(/[“”"]/);
    expect(vraag3?.options[0]?.text).toBe(
      'Die uitslag heb ik niet. Ik hoor dat u hem graag nu zou willen.',
    );
  });
});
