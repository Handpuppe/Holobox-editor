import type { TeacherSettings } from './types';
import { DEFAULT_DISPLAY_HEIGHT_CM } from './types';

export const defaultTeacherSettings = (): TeacherSettings => ({
  displayHeightCm: DEFAULT_DISPLAY_HEIGHT_CM,
  floorBaseline: 0.02,
  scaleCorrection: 1,
  patientHeightByModule: {
    logopedie: 170,
    verpleegkunde: 170,
  },
  mediaOverrides: {},
});

export function clampTeacherSettings(value: TeacherSettings): TeacherSettings {
  return {
    displayHeightCm: Math.min(
      240,
      Math.max(160, value.displayHeightCm || DEFAULT_DISPLAY_HEIGHT_CM),
    ),
    floorBaseline: Math.min(0.18, Math.max(0.02, value.floorBaseline)),
    scaleCorrection: Math.min(1.15, Math.max(0.85, value.scaleCorrection || 1)),
    patientHeightByModule: {
      logopedie: Math.min(200, Math.max(140, value.patientHeightByModule.logopedie || 170)),
      verpleegkunde: Math.min(200, Math.max(140, value.patientHeightByModule.verpleegkunde || 170)),
    },
    mediaOverrides: value.mediaOverrides ?? {},
  };
}
