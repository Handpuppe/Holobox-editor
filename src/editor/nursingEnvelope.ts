import { withBaseUrl } from '../media/baseUrl';
import type { MediaSlotConfig } from '../media/types';
import { builtInNursingScenario } from '../nursing/scenario';
import type {
  NursingOption,
  NursingPatient,
  NursingScenario,
  NursingScenarioMeta,
  NursingStep,
} from '../nursing/types';
import { isMediaSlotConfig, validateNursingScenario } from '../nursing/validateNursing';

export const VERPLEEGKUNDE_ENVELOPE_SCHEMA_VERSION = 1;
export const VERPLEEGKUNDE_ENVELOPE_MODULE = 'verpleegkunde';
export const VERPLEEGKUNDE_ENVELOPE_FILENAME = 'verpleegkunde.json';
export const EDITOR_SAVE_VERPLEEGKUNDE_PATH = '/editor-api/save-verpleegkunde';

export interface VerpleegkundeScenarioEnvelope {
  schemaVersion: 1;
  module: 'verpleegkunde';
  meta: NursingScenarioMeta;
  patient: NursingPatient;
  learningObjectives: string[];
  steps: NursingStep[];
  mediaSlots: MediaSlotConfig[];
}

export type NursingEnvelopeParseResult =
  { ok: true; scenario: NursingScenario } | { ok: false; error: string };

export function toVerpleegkundeEnvelope(scenario: NursingScenario): VerpleegkundeScenarioEnvelope {
  return {
    schemaVersion: VERPLEEGKUNDE_ENVELOPE_SCHEMA_VERSION,
    module: VERPLEEGKUNDE_ENVELOPE_MODULE,
    meta: scenario.meta,
    patient: scenario.patient,
    learningObjectives: scenario.learningObjectives,
    steps: scenario.steps,
    mediaSlots: scenario.mediaSlots,
  };
}

export function nursingEnvelopeJson(scenario: NursingScenario): string {
  return `${JSON.stringify(toVerpleegkundeEnvelope(scenario), null, 2)}\n`;
}

export async function saveNursingEnvelopeToCopy(
  scenario: NursingScenario,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch(withBaseUrl(EDITOR_SAVE_VERPLEEGKUNDE_PATH), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: nursingEnvelopeJson(scenario),
    });
    if (!response.ok) {
      let message = 'Opslaan is mislukt.';
      try {
        const payload = (await response.json()) as { error?: string };
        if (typeof payload.error === 'string' && payload.error.trim()) {
          message = payload.error;
        }
      } catch {
        // keep default
      }
      return { ok: false, error: message };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: 'Opslaan is niet beschikbaar. Start de bewerker via Editor.exe of npm run dev.',
    };
  }
}

export function downloadNursingEnvelope(scenario: NursingScenario): void {
  const blob = new Blob([nursingEnvelopeJson(scenario)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = VERPLEEGKUNDE_ENVELOPE_FILENAME;
  link.click();
  URL.revokeObjectURL(url);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function parseMeta(value: unknown): NursingScenarioMeta | string {
  if (!isRecord(value)) {
    return 'meta ontbreekt of is ongeldig.';
  }
  if (
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.version) ||
    !isNonEmptyString(value.rubricVersion) ||
    typeof value.title !== 'string' ||
    typeof value.estimatedDuration !== 'string' ||
    !isNonEmptyString(value.startStepId)
  ) {
    return 'meta mist identificatie, titel of startstap.';
  }
  return {
    id: value.id,
    version: value.version,
    rubricVersion: value.rubricVersion,
    title: value.title,
    estimatedDuration: value.estimatedDuration,
    startStepId: value.startStepId,
  };
}

function parsePatient(value: unknown): NursingPatient | string {
  if (!isRecord(value) || typeof value.name !== 'string') {
    return 'patiëntprofiel ontbreekt.';
  }
  return {
    name: value.name,
    age: typeof value.age === 'number' ? value.age : 0,
    fictional: true,
    heightCm: typeof value.heightCm === 'number' ? value.heightCm : 170,
    setting: typeof value.setting === 'string' ? value.setting : '',
    background: typeof value.background === 'string' ? value.background : '',
    studentRole: typeof value.studentRole === 'string' ? value.studentRole : '',
  };
}

export function parseVerpleegkundeEnvelope(text: string): NursingEnvelopeParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Dit bestand is geen geldige JSON.' };
  }
  if (!isRecord(data)) {
    return { ok: false, error: 'Het JSON-bestand heeft niet de verwachte vorm.' };
  }
  if (data.schemaVersion !== VERPLEEGKUNDE_ENVELOPE_SCHEMA_VERSION) {
    return { ok: false, error: 'schemaVersion moet 1 zijn.' };
  }
  if (data.module !== VERPLEEGKUNDE_ENVELOPE_MODULE) {
    return { ok: false, error: 'module moet verpleegkunde zijn.' };
  }
  const meta = parseMeta(data.meta);
  if (typeof meta === 'string') {
    return { ok: false, error: meta };
  }
  const patient = parsePatient(data.patient);
  if (typeof patient === 'string') {
    return { ok: false, error: patient };
  }
  if (!Array.isArray(data.learningObjectives)) {
    return { ok: false, error: 'leerdoelen ontbreken.' };
  }
  if (!Array.isArray(data.steps) || data.steps.length === 0) {
    return { ok: false, error: 'stappen ontbreken.' };
  }
  if (!Array.isArray(data.mediaSlots) || data.mediaSlots.length === 0) {
    return { ok: false, error: 'mediaslots ontbreken.' };
  }
  if (!data.mediaSlots.every(isMediaSlotConfig)) {
    return {
      ok: false,
      error: 'een mediaslot is ongeldig of ligt buiten resources/verpleegkunde/.',
    };
  }
  try {
    const scenario = structuredClone({
      meta,
      patient,
      learningObjectives: data.learningObjectives.filter(
        (item): item is string => typeof item === 'string',
      ),
      steps: data.steps as NursingStep[],
      mediaSlots: data.mediaSlots,
    }) as NursingScenario;
    const issues = validateNursingScenario(scenario);
    if (issues.length > 0) {
      return { ok: false, error: issues[0] ?? 'Het scenario is ongeldig.' };
    }
    return { ok: true, scenario };
  } catch {
    return { ok: false, error: 'Het scenario kon niet worden geladen.' };
  }
}

export function seedNursingEnvelope(): VerpleegkundeScenarioEnvelope {
  return toVerpleegkundeEnvelope(builtInNursingScenario);
}

export type { NursingOption, NursingStep };
