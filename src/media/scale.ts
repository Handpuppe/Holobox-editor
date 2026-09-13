import { DEFAULT_DISPLAY_HEIGHT_CM, STAGE_HEIGHT_PX, type PatientDisplayConfig } from './types';

export function recommendedPatientHeightPx(config: PatientDisplayConfig): number {
  const display = config.displayHeightCm > 0 ? config.displayHeightCm : DEFAULT_DISPLAY_HEIGHT_CM;
  const patient = config.patientHeightCm > 0 ? config.patientHeightCm : display;
  const correction = Number.isFinite(config.scaleCorrection) ? config.scaleCorrection : 1;
  return (patient / display) * STAGE_HEIGHT_PX * correction;
}

export function visiblePatientHeightPx(config: PatientDisplayConfig): number {
  const recommended = recommendedPatientHeightPx(config);
  const floorPx = Math.max(0, Math.min(0.18, config.floorBaseline)) * STAGE_HEIGHT_PX;
  const maxVisible = STAGE_HEIGHT_PX - floorPx;
  return Math.min(recommended, maxVisible);
}

export function defaultDisplayConfig(
  patientHeightCm: number,
  displayHeightCm = DEFAULT_DISPLAY_HEIGHT_CM,
): PatientDisplayConfig {
  return {
    patientHeightCm,
    displayHeightCm,
    floorBaseline: 0.02,
    scaleCorrection: 1,
  };
}
