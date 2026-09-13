import type { Scenario } from '../domain/types';

export const LOGOPEDIE_ENVELOPE_SCHEMA_VERSION = 1;
export const LOGOPEDIE_ENVELOPE_MODULE = 'logopedie';
export const LOGOPEDIE_ENVELOPE_FILENAME = 'logopedie.json';

export interface LogopedieScenarioEnvelope {
  schemaVersion: 1;
  module: 'logopedie';
  scenario: Scenario;
}

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

export function downloadEnvelope(scenario: Scenario): void {
  const blob = new Blob([envelopeJson(scenario)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = LOGOPEDIE_ENVELOPE_FILENAME;
  link.click();
  URL.revokeObjectURL(url);
}
