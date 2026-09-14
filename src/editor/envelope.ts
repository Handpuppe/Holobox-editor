import { withBaseUrl } from '../media/baseUrl';
import type { Scenario } from '../domain/types';

export const LOGOPEDIE_ENVELOPE_SCHEMA_VERSION = 1;
export const LOGOPEDIE_ENVELOPE_MODULE = 'logopedie';
export const LOGOPEDIE_ENVELOPE_FILENAME = 'logopedie.json';
export const EDITOR_SAVE_LOGOPEDIE_PATH = '/editor-api/save-logopedie';

export interface LogopedieScenarioEnvelope {
  schemaVersion: 1;
  module: 'logopedie';
  scenario: Scenario;
}

export type EnvelopeParseResult = { ok: true; scenario: Scenario } | { ok: false; error: string };

export function toLogopedieEnvelope(scenario: Scenario): LogopedieScenarioEnvelope {
  return {
    schemaVersion: LOGOPEDIE_ENVELOPE_SCHEMA_VERSION,
    module: LOGOPEDIE_ENVELOPE_MODULE,
    scenario,
  };
}

export function envelopeJson(scenario: Scenario): string {
  return `${JSON.stringify(toLogopedieEnvelope(scenario), null, 2)}\n`;
}

export async function saveEnvelopeToCopy(
  scenario: Scenario,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch(withBaseUrl(EDITOR_SAVE_LOGOPEDIE_PATH), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: envelopeJson(scenario),
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

export function downloadEnvelope(scenario: Scenario): void {
  const blob = new Blob([envelopeJson(scenario)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = LOGOPEDIE_ENVELOPE_FILENAME;
  link.click();
  URL.revokeObjectURL(url);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function scenarioShapeError(scenario: Record<string, unknown>): string | null {
  if (
    !isNonEmptyString(scenario.id) ||
    !isNonEmptyString(scenario.version) ||
    !isNonEmptyString(scenario.rubricVersion) ||
    typeof scenario.title !== 'string' ||
    typeof scenario.estimatedDuration !== 'string' ||
    !isNonEmptyString(scenario.startNodeId)
  ) {
    return 'scenario mist identificatie, titel of startvraag.';
  }
  if (!isRecord(scenario.client) || typeof scenario.client.name !== 'string') {
    return 'scenario mist een cliëntprofiel.';
  }
  if (
    !isRecord(scenario.briefing) ||
    typeof scenario.briefing.medicalBackground !== 'string' ||
    typeof scenario.briefing.consultationContext !== 'string' ||
    typeof scenario.briefing.studentRole !== 'string'
  ) {
    return 'scenario mist briefingteksten.';
  }
  if (!Array.isArray(scenario.learningObjectives)) {
    return 'scenario mist leerdoelen.';
  }
  if (!Array.isArray(scenario.nodes) || scenario.nodes.length === 0) {
    return 'scenario mist beslissingspunten.';
  }
  for (const node of scenario.nodes) {
    if (!isRecord(node) || !isNonEmptyString(node.id) || !Array.isArray(node.options)) {
      return 'een beslissingspunt is onvolledig.';
    }
    if (node.options.length !== 3) {
      return `vraag ${node.id} moet precies drie antwoorden hebben.`;
    }
    if (!isRecord(node.prompt) || typeof node.prompt.text !== 'string') {
      return `vraag ${node.id} mist de cliënttekst.`;
    }
    for (const option of node.options) {
      if (
        !isRecord(option) ||
        !isNonEmptyString(option.id) ||
        typeof option.text !== 'string' ||
        typeof option.nextNodeId !== 'string' ||
        !isRecord(option.clientResponse) ||
        typeof option.clientResponse.text !== 'string'
      ) {
        return `een antwoord in vraag ${node.id} is onvolledig.`;
      }
    }
  }
  if (!Array.isArray(scenario.conclusionFields)) {
    return 'scenario mist het conclusieformulier.';
  }
  return null;
}

export function parseLogopedieEnvelope(text: string): EnvelopeParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Dit bestand is geen geldige JSON.' };
  }
  if (!isRecord(data)) {
    return { ok: false, error: 'Het JSON-bestand heeft niet de verwachte vorm.' };
  }
  if (data.schemaVersion !== LOGOPEDIE_ENVELOPE_SCHEMA_VERSION) {
    return { ok: false, error: 'schemaVersion moet 1 zijn.' };
  }
  if (data.module !== LOGOPEDIE_ENVELOPE_MODULE) {
    return { ok: false, error: 'module moet logopedie zijn.' };
  }
  if (!isRecord(data.scenario)) {
    return { ok: false, error: 'scenario ontbreekt of is ongeldig.' };
  }
  const shapeError = scenarioShapeError(data.scenario);
  if (shapeError) {
    return { ok: false, error: shapeError };
  }
  try {
    return { ok: true, scenario: structuredClone(data.scenario) as unknown as Scenario };
  } catch {
    return { ok: false, error: 'Het scenario kon niet worden geladen.' };
  }
}
