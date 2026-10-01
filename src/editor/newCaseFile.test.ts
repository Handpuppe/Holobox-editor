import { describe, expect, it } from 'vitest';
import { newCaseFileName, overlayScenarioFileName } from './newCaseFile';

describe('new case filename', () => {
  it('builds a unique extra file and never uses the overlay names', () => {
    const at = new Date('2026-10-01T12:00:00.000Z');
    expect(overlayScenarioFileName('logopedie')).toBe('logopedie.json');
    expect(overlayScenarioFileName('verpleegkunde')).toBe('verpleegkunde.json');
    const logopedie = newCaseFileName('logopedie', 'Intake afasie', at);
    expect(logopedie).toBe('logopedie-intake-afasie-2026-10-01T12-00-00.json');
    expect(logopedie).not.toBe('logopedie.json');
    const nursing = newCaseFileName('verpleegkunde', '', at);
    expect(nursing).toBe('verpleegkunde-casus-2026-10-01T12-00-00.json');
    expect(nursing).not.toBe('verpleegkunde.json');
  });
});
