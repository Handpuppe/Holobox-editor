import { describe, expect, it } from 'vitest';
import { aphasiaIntakeScenario } from '../data/aphasiaIntakeScenario';
import { EMPTY_CONCLUSION, sanitizeConclusion, validateConclusion } from './conclusion';
import { conclusionByQuality } from './playthrough';

describe('conclusion validation', () => {
  it('rejects an empty form', () => {
    const result = validateConclusion(EMPTY_CONCLUSION, aphasiaIntakeScenario);
    expect(result.valid).toBe(false);
    expect(result.errors.primaryDifficulty).toBeTruthy();
    expect(result.errors.dailyLifeText).toBeTruthy();
  });

  it('accepts a complete high-quality conclusion', () => {
    const result = validateConclusion(
      conclusionByQuality(aphasiaIntakeScenario, 'high'),
      aphasiaIntakeScenario,
    );
    expect(result.valid).toBe(true);
  });

  it('sanitizes free text and ignores markup', () => {
    const dirty = conclusionByQuality(aphasiaIntakeScenario, 'high');
    dirty.freeText.dailyLifeEffect =
      '  <script>alert(1)</script>   Gesprekken thuis zijn lastig.  ';
    const clean = sanitizeConclusion(dirty);
    expect(clean.freeText.dailyLifeEffect).toBe('alert(1)   Gesprekken thuis zijn lastig.');
    expect(clean.freeText.dailyLifeEffect.includes('<script>')).toBe(false);
  });
});
