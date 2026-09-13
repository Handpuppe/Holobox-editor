export type TrainingModule = 'logopedie' | 'verpleegkunde';

export type MediaFileType = 'video' | 'image';

export type PatientMediaState =
  | 'laden'
  | 'idle'
  | 'observeren'
  | 'spreken'
  | 'luisteren'
  | 'nadenken'
  | 'angstig'
  | 'gefrustreerd'
  | 'vermoeid'
  | 'kritiek'
  | 'gepauzeerd'
  | 'afgerond'
  | 'mediafout';

export interface MediaManifestItem {
  relativePath: string;
  module: TrainingModule;
  fileType: MediaFileType;
  extension: string;
  sizeBytes: number;
  normalizedName: string;
  keywords: readonly string[];
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  publicUrl: string;
  warnings: readonly string[];
}

export interface MediaSlotConfig {
  slotId: string;
  scenarioId: string;
  module: TrainingModule;
  matchedKeywords: string[];
  primaryMedia: string | null;
  idleMedia: string | null;
  posterImage: string | null;
  transcript: string;
  captions: string;
  alternativeMatches: string[];
  loopBehaviour: 'none' | 'idle-after-gesture';
  audioEnabled: boolean;
  studentLabel: string;
}

export interface PatientDisplayConfig {
  patientHeightCm: number;
  displayHeightCm: number;
  floorBaseline: number;
  scaleCorrection: number;
}

export interface TeacherSettings {
  displayHeightCm: number;
  floorBaseline: number;
  scaleCorrection: number;
  patientHeightByModule: Record<TrainingModule, number>;
  mediaOverrides: Record<string, string>;
}

export const DEFAULT_DISPLAY_HEIGHT_CM = 200;
export const STAGE_HEIGHT_PX = 1920;
export const STAGE_WIDTH_PX = 1080;
export const PATIENT_AREA_MAX_WIDTH_PX = 864;
export const QUESTION_PANEL_MAX_WIDTH_PX = 216;
