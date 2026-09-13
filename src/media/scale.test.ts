import { describe, expect, it } from 'vitest';
import { recommendedPatientHeightPx, visiblePatientHeightPx } from './scale';

describe('life-size scale', () => {
  it('maps 170 cm on a 200 cm display to 1632 px', () => {
    expect(
      recommendedPatientHeightPx({
        patientHeightCm: 170,
        displayHeightCm: 200,
        floorBaseline: 0.02,
        scaleCorrection: 1,
      }),
    ).toBe(1632);
  });

  it('maps 180 cm on a 200 cm display to 1728 px', () => {
    expect(
      recommendedPatientHeightPx({
        patientHeightCm: 180,
        displayHeightCm: 200,
        floorBaseline: 0.06,
        scaleCorrection: 1,
      }),
    ).toBe(1728);
  });

  it('never stretches beyond the stage minus floor', () => {
    const visible = visiblePatientHeightPx({
      patientHeightCm: 220,
      displayHeightCm: 200,
      floorBaseline: 0.06,
      scaleCorrection: 1.15,
    });
    expect(visible).toBeLessThan(1920);
  });
});
