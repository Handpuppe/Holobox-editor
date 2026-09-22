import { withBaseUrl } from '../media/baseUrl';
import type { MediaSlotConfig } from '../media/types';
import type { NursingScenario, NursingStep } from '../nursing/types';

export const EDITOR_NURSING_MEDIA_PATH = '/editor-api/verpleegkunde-media';
export const NURSING_MEDIA_PREFIX = 'verpleegkunde/';
export const NURSING_MEDIA_EXTENSIONS = [
  '.mp4',
  '.webm',
  '.mov',
  '.m4v',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.avif',
] as const;

export interface NursingMediaItem {
  relativePath: string;
  sizeBytes: number;
}

export type StagedNursingMediaOp =
  | {
      type: 'add' | 'replace';
      relativePath: string;
      file: File;
      previewUrl: string;
    }
  | { type: 'delete'; relativePath: string };

export function isNursingMediaPath(relativePath: string): boolean {
  const normalized = relativePath.replaceAll('\\', '/').replace(/^\/+/, '');
  if (!normalized.startsWith(NURSING_MEDIA_PREFIX)) {
    return false;
  }
  if (normalized.includes('..') || normalized.includes('logopedie')) {
    return false;
  }
  return NURSING_MEDIA_EXTENSIONS.some((ext) => normalized.toLowerCase().endsWith(ext));
}

export function nursingMediaRowTestId(relativePath: string): string {
  return `nursing-media-row-${relativePath.replaceAll('/', '_')}`;
}

export async function listNursingMedia(): Promise<NursingMediaItem[]> {
  const response = await fetch(withBaseUrl(EDITOR_NURSING_MEDIA_PATH), { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('De lijst met Verpleegkunde-media kon niet worden geladen.');
  }
  const payload = (await response.json()) as { ok?: boolean; items?: NursingMediaItem[] };
  return Array.isArray(payload.items) ? payload.items : [];
}

export async function saveNursingMediaOp(op: StagedNursingMediaOp): Promise<void> {
  if (op.type === 'delete') {
    const url = `${withBaseUrl(EDITOR_NURSING_MEDIA_PATH)}?path=${encodeURIComponent(op.relativePath)}`;
    const response = await fetch(url, { method: 'DELETE' });
    if (!response.ok) {
      throw new Error(`Verwijderen van ${op.relativePath} is mislukt.`);
    }
    return;
  }
  const buffer = await op.file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const response = await fetch(withBaseUrl(EDITOR_NURSING_MEDIA_PATH), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      relativePath: op.relativePath,
      replace: op.type === 'replace',
      contentBase64: btoa(binary),
    }),
  });
  if (!response.ok) {
    let message = `Opslaan van ${op.relativePath} is mislukt.`;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) {
        message = payload.error;
      }
    } catch {
      // keep default
    }
    throw new Error(message);
  }
}

export function nursingRelativePathForFile(fileName: string): string | null {
  const normalized = fileName.replaceAll('\\', '/');
  if (normalized.includes('..') || normalized.toLowerCase().includes('logopedie')) {
    return null;
  }
  const base = normalized.split('/').pop()?.trim() ?? '';
  if (!base || base.toLowerCase() === 'erik_basis.png') {
    return null;
  }
  return isNursingMediaPath(`${NURSING_MEDIA_PREFIX}${base}`)
    ? `${NURSING_MEDIA_PREFIX}${base}`
    : null;
}

export function stepPrimaryMediaPath(scenario: NursingScenario, step: NursingStep): string | null {
  const slot = scenario.mediaSlots.find((item) => item.slotId === step.mediaSlotId);
  const path = slot?.primaryMedia;
  return path && path.trim() ? path.replaceAll('\\', '/') : null;
}

function slotUsedByOthers(scenario: NursingScenario, slotId: string, stepId: string): boolean {
  for (const step of scenario.steps) {
    if (step.id === stepId) {
      if (step.options.some((option) => option.mediaSlotId === slotId)) {
        return true;
      }
      continue;
    }
    if (step.mediaSlotId === slotId) {
      return true;
    }
    if (step.options.some((option) => option.mediaSlotId === slotId)) {
      return true;
    }
  }
  return false;
}

function dedicatedSlotId(stepId: string): string {
  return `nursing-step-${stepId}`;
}

function makeStepSlot(
  template: MediaSlotConfig,
  step: NursingStep,
  slotId: string,
  relativePath: string | null,
): MediaSlotConfig {
  return {
    ...template,
    slotId,
    module: 'verpleegkunde',
    matchedKeywords: [],
    primaryMedia: relativePath,
    idleMedia: null,
    posterImage: null,
    alternativeMatches: [],
    studentLabel: step.phaseLabel,
    transcript: step.help || step.question,
    captions: 'Fictieve onderwijssituatie.',
  };
}

export function assignStepPrimaryMedia(
  scenario: NursingScenario,
  stepId: string,
  relativePath: string | null,
): NursingScenario {
  const step = scenario.steps.find((item) => item.id === stepId);
  if (!step) {
    return scenario;
  }
  if (relativePath && !isNursingMediaPath(relativePath)) {
    return scenario;
  }
  const current = stepPrimaryMediaPath(scenario, step);
  if (current === relativePath) {
    return scenario;
  }
  const shared = slotUsedByOthers(scenario, step.mediaSlotId, step.id);
  if (!shared) {
    return {
      ...scenario,
      mediaSlots: scenario.mediaSlots.map((slot) =>
        slot.slotId === step.mediaSlotId ? { ...slot, primaryMedia: relativePath } : slot,
      ),
    };
  }
  const slotId = dedicatedSlotId(step.id);
  const template =
    scenario.mediaSlots.find((slot) => slot.slotId === step.mediaSlotId) ?? scenario.mediaSlots[0];
  if (!template) {
    return scenario;
  }
  const existing = scenario.mediaSlots.some((slot) => slot.slotId === slotId);
  const nextSlot = makeStepSlot(template, step, slotId, relativePath);
  return {
    ...scenario,
    mediaSlots: existing
      ? scenario.mediaSlots.map((slot) => (slot.slotId === slotId ? nextSlot : slot))
      : [...scenario.mediaSlots, nextSlot],
    steps: scenario.steps.map((item) =>
      item.id === stepId ? { ...item, mediaSlotId: slotId } : item,
    ),
  };
}

export function unlinkDeletedNursingMedia(
  scenario: NursingScenario,
  relativePath: string,
): NursingScenario {
  const normalized = relativePath.replaceAll('\\', '/');
  return {
    ...scenario,
    mediaSlots: scenario.mediaSlots.map((slot) =>
      slot.primaryMedia?.replaceAll('\\', '/') === normalized
        ? { ...slot, primaryMedia: null }
        : slot,
    ),
  };
}

export function applyStagedNursingMedia(
  items: NursingMediaItem[],
  staged: StagedNursingMediaOp[],
): Array<NursingMediaItem & { previewUrl?: string; stagedType?: StagedNursingMediaOp['type'] }> {
  const next = new Map(
    items.map((item) => [
      item.relativePath,
      { ...item } as NursingMediaItem & {
        previewUrl?: string;
        stagedType?: StagedNursingMediaOp['type'];
      },
    ]),
  );
  for (const op of staged) {
    if (op.type === 'delete') {
      next.delete(op.relativePath);
      continue;
    }
    next.set(op.relativePath, {
      relativePath: op.relativePath,
      sizeBytes: op.file.size,
      previewUrl: op.previewUrl,
      stagedType: op.type,
    });
  }
  return [...next.values()].sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'nl'));
}
