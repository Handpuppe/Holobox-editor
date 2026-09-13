import type { ClientEmotion } from '../domain/types';

export interface EditorFace {
  emotion: ClientEmotion;
  label: string;
}

export const EDITOR_FACES: readonly EditorFace[] = [
  { emotion: 'reassured', label: 'Opgelucht' },
  { emotion: 'listening', label: 'Luistert' },
  { emotion: 'neutral', label: 'Onzeker' },
  { emotion: 'thinking', label: 'Woordzoekend' },
  { emotion: 'confused', label: 'Verward' },
  { emotion: 'frustrated', label: 'Gefrustreerd' },
] as const;

export function faceLabel(emotion: ClientEmotion): string {
  return EDITOR_FACES.find((face) => face.emotion === emotion)?.label ?? emotion;
}
