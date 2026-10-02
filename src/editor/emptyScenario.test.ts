import { describe, expect, it } from 'vitest';
import { aphasiaIntakeScenario } from '../data/aphasiaIntakeScenario';
import { builtInNursingScenario } from '../nursing/scenario';
import { emptyLogopedieScenario, emptyNursingScenario } from './emptyScenario';
import { envelopeJson, parseLogopedieEnvelope } from './envelope';
import { nursingEnvelopeJson, parseVerpleegkundeEnvelope } from './nursingEnvelope';

describe('empty editor scenario', () => {
  it('clears Logopedie title and questions without changing the seed', () => {
    const empty = emptyLogopedieScenario();
    expect(empty.title).toBe('');
    expect(empty.nodes[0]?.prompt.text).toBe('');
    expect(empty.nodes[0]?.options[0]?.text).toBe('');
    expect(empty.nodes.every((node) => node.prompt.text === '')).toBe(true);
    expect(aphasiaIntakeScenario.title.length).toBeGreaterThan(0);
    expect(aphasiaIntakeScenario.nodes[0]?.prompt.text.length).toBeGreaterThan(0);
    const parsed = parseLogopedieEnvelope(envelopeJson(empty));
    expect(parsed.ok).toBe(true);
  });

  it('starts Verpleegkunde with one empty step and leaves the lesson scenario intact', () => {
    const empty = emptyNursingScenario();
    expect(empty.steps).toHaveLength(1);
    expect(empty.meta.title).toBe('');
    expect(empty.meta.educationType).toBe('');
    expect(empty.steps[0]?.question).toBe('');
    expect(empty.steps[0]?.stepName).toBe('Vraag.1');
    expect(empty.steps[0]?.phaseLabel).toBe('');
    expect(empty.steps[0]?.options.map((option) => option.text)).toEqual(['', '', '']);
    expect(empty.steps[0]?.options.every((option) => option.criticalError === undefined)).toBe(
      true,
    );
    expect(empty.steps[0]?.stepVideoPlaceholder ?? '').toBe('');
    expect(empty.mediaSlots).toHaveLength(1);
    expect(empty.mediaSlots.every((slot) => slot.primaryMedia === null)).toBe(true);
    expect(JSON.stringify(empty)).not.toContain('luchtweg');
    expect(JSON.stringify(empty)).not.toContain('SBAR');
    expect(builtInNursingScenario.steps.length).toBeGreaterThan(1);
    expect(builtInNursingScenario.meta.title.length).toBeGreaterThan(0);
    expect(builtInNursingScenario.steps[0]?.question).toContain('luchtweg');
    expect(builtInNursingScenario.mediaSlots.some((slot) => Boolean(slot.primaryMedia))).toBe(
      true,
    );
    const envelope = JSON.parse(nursingEnvelopeJson(empty)) as {
      module: string;
      meta: { title: string };
      steps: Array<{ question: string }>;
      mediaSlots: Array<{ primaryMedia: string | null }>;
    };
    expect(envelope.module).toBe('verpleegkunde');
    expect(envelope.meta.title).toBe('');
    expect(envelope.steps[0]?.question).toBe('');
    expect(envelope.mediaSlots.every((slot) => slot.primaryMedia === null)).toBe(true);
    expect(parseVerpleegkundeEnvelope(nursingEnvelopeJson(empty)).ok).toBe(true);
  });
});
