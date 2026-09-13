import type { ClientEmotion } from '../../domain/types';
import { withBaseUrl } from '../baseUrl';
import { listModuleMedia } from '../matching';

export const AVATAR_LAYERS = ['variant', 'neutral', 'basis', 'legacy'] as const;
export type AvatarLayer = (typeof AVATAR_LAYERS)[number];

export const LOGOPEDIE_AVATAR_DIR = 'logopedie/avatar';
export const LOGOPEDIE_GENERATED_DIR = 'logopedie/avatar/generated/erik';
export const LOGOPEDIE_BASIS_FILE = 'erik_basis.png';
export const LOGOPEDIE_BASIS_PATH = `${LOGOPEDIE_AVATAR_DIR}/${LOGOPEDIE_BASIS_FILE}`;

export const AVATAR_VARIANTS = [
  'neutraal',
  'luistert',
  'onzeker',
  'woordzoekend',
  'verward',
  'gefrustreerd',
  'vermoeid',
  'opgelucht',
  'spreekt_gesloten',
  'spreekt_halfopen',
  'spreekt_open',
] as const;
export type AvatarVariant = (typeof AVATAR_VARIANTS)[number];

export const SPEAKING_VISEMES = ['spreekt_gesloten', 'spreekt_halfopen', 'spreekt_open'] as const;

export const AVATAR_FILES: Record<AvatarVariant, string> = {
  neutraal: `${LOGOPEDIE_GENERATED_DIR}/neutraal.png`,
  luistert: `${LOGOPEDIE_GENERATED_DIR}/luistert.png`,
  onzeker: `${LOGOPEDIE_GENERATED_DIR}/onzeker.png`,
  woordzoekend: `${LOGOPEDIE_GENERATED_DIR}/woordzoekend.png`,
  verward: `${LOGOPEDIE_GENERATED_DIR}/verward.png`,
  gefrustreerd: `${LOGOPEDIE_GENERATED_DIR}/gefrustreerd.png`,
  vermoeid: `${LOGOPEDIE_GENERATED_DIR}/vermoeid.png`,
  opgelucht: `${LOGOPEDIE_GENERATED_DIR}/opgelucht.png`,
  spreekt_gesloten: `${LOGOPEDIE_GENERATED_DIR}/spreekt_gesloten.png`,
  spreekt_halfopen: `${LOGOPEDIE_GENERATED_DIR}/spreekt_halfopen.png`,
  spreekt_open: `${LOGOPEDIE_GENERATED_DIR}/spreekt_open.png`,
};

export const EMOTION_VARIANT: Record<ClientEmotion, AvatarVariant> = {
  neutral: 'onzeker',
  listening: 'luistert',
  thinking: 'woordzoekend',
  confused: 'verward',
  frustrated: 'gefrustreerd',
  fatigued: 'verward',
  reassured: 'opgelucht',
  speaking: 'luistert',
};

export interface AvatarCandidate {
  layer: AvatarLayer;
  variant: AvatarVariant | 'basis' | 'legacy';
  relativePath: string | null;
}

export function publicResourceUrl(relativePath: string): string {
  return withBaseUrl(
    `/resources/${relativePath
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/')}`,
  );
}

export function resourceSrc(relativePath: string): string {
  const item = listModuleMedia('logopedie').find((entry) => entry.relativePath === relativePath);
  const url = publicResourceUrl(relativePath);
  return item ? `${url}?v=${String(item.sizeBytes)}` : url;
}

export function avatarVariantFor(emotion: ClientEmotion): AvatarVariant {
  return EMOTION_VARIANT[emotion];
}

export function avatarSourceChain(emotion: ClientEmotion): AvatarCandidate[] {
  const preferred = avatarVariantFor(emotion);
  const chain: AvatarCandidate[] = [];
  const seen = new Set<string>();

  const push = (candidate: AvatarCandidate) => {
    const key = candidate.relativePath ?? '__legacy__';
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    chain.push(candidate);
  };

  if (preferred !== 'neutraal') {
    push({ layer: 'variant', variant: preferred, relativePath: AVATAR_FILES[preferred] });
    if (emotion === 'thinking' || emotion === 'confused') {
      push({ layer: 'variant', variant: 'onzeker', relativePath: AVATAR_FILES.onzeker });
    }
  }
  push({ layer: 'neutral', variant: 'neutraal', relativePath: AVATAR_FILES.neutraal });
  push({ layer: 'basis', variant: 'basis', relativePath: LOGOPEDIE_BASIS_PATH });
  push({ layer: 'legacy', variant: 'legacy', relativePath: null });
  return chain;
}

export function logopedieBasisSrc(): string {
  return resourceSrc(LOGOPEDIE_BASIS_PATH);
}
