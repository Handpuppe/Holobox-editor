import { describe, expect, it, vi } from 'vitest';
import { envelopeJson } from './envelope';
import { cloneScenario } from './cloneScenario';
import { saveEnvelopeAsNewCase } from './saveAsCase';

describe('save as new case', () => {
  it('posts the draft to the save-as API and returns the extra file', async () => {
    const draft = cloneScenario();
    draft.title = 'Nieuwe logopediecasus';
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(
        JSON.stringify({
          ok: true,
          file: 'resources/scenarios/logopedie-nieuwe-logopediecasus.json',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await saveEnvelopeAsNewCase('logopedie', envelopeJson(draft), draft.title);
    expect(result).toEqual({
      ok: true,
      file: 'resources/scenarios/logopedie-nieuwe-logopediecasus.json',
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('save-as-case');
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      module: string;
      fileName: string;
      envelopeText: string;
    };
    expect(body.module).toBe('logopedie');
    expect(body.fileName).not.toBe('logopedie.json');
    expect(body.envelopeText).toContain('Nieuwe logopediecasus');
  });
});
