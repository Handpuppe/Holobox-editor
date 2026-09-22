import { afterEach, describe, expect, it, vi } from 'vitest';
import { cloneNursingScenario } from './cloneNursing';
import { cloneScenario } from './cloneScenario';
import { envelopeJson } from './envelope';
import { nursingEnvelopeJson } from './nursingEnvelope';
import {
  buildEditorPackageZip,
  editorPackageIssues,
  parseEditorPackageZip,
  pickZipFileToImport,
  saveExportedZipAs,
  suggestedZipName,
} from './scenarioPackage';

describe('editor scenario package', () => {
  it('packs and unpacks a logopedie package with media under logopedie/', () => {
    const draft = cloneScenario();
    draft.nodes[0]!.prompt.text = 'Tekst uit het pakket.';
    const zip = buildEditorPackageZip('logopedie', envelopeJson(draft), [
      { relativePath: 'logopedie/avatar/erik_basis.png', data: new Uint8Array([10, 20]) },
    ]);
    const parsed = parseEditorPackageZip(zip);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok || parsed.module !== 'logopedie') {
      return;
    }
    expect(parsed.scenario.nodes[0]?.prompt.text).toBe('Tekst uit het pakket.');
    expect(parsed.media).toHaveLength(1);
    expect(parsed.media[0]?.relativePath).toBe('logopedie/avatar/erik_basis.png');
    expect(editorPackageIssues(parsed)).toEqual([]);
  });

  it('rejects verpleegkunde media in a logopedie package', () => {
    const zip = buildEditorPackageZip('logopedie', envelopeJson(cloneScenario()), [
      { relativePath: 'verpleegkunde/Staat is pijn.mp4', data: new Uint8Array([1]) },
    ]);
    const parsed = parseEditorPackageZip(zip);
    expect(parsed.ok).toBe(false);
  });

  it('runs Fase A on a nursing package without a video', () => {
    const draft = cloneNursingScenario();
    const slot = draft.mediaSlots.find((item) => item.slotId === draft.steps[0]?.mediaSlotId);
    if (slot) {
      slot.primaryMedia = null;
    }
    const parsed = parseEditorPackageZip(
      buildEditorPackageZip('verpleegkunde', nursingEnvelopeJson(draft), []),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(editorPackageIssues(parsed).some((item) => item.includes('zonder video'))).toBe(true);
  });

  it('opens a save-as picker and still treats cancel as keeping the exports copy', async () => {
    expect(suggestedZipName('exports/logopedie-demo.zip')).toBe('logopedie-demo.zip');
    Object.defineProperty(navigator, 'webdriver', { configurable: true, value: false });
    window.showSaveFilePicker = vi.fn().mockRejectedValue(new DOMException('Abort', 'AbortError'));
    await expect(saveExportedZipAs('exports/logopedie-demo.zip')).resolves.toBe('cancelled');

    const written: ArrayBuffer[] = [];
    window.showSaveFilePicker = vi.fn().mockResolvedValue({
      createWritable: async () => ({
        write: async (data: BufferSource) => {
          written.push(data as ArrayBuffer);
        },
        close: async () => undefined,
      }),
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })),
    );
    await expect(saveExportedZipAs('exports/logopedie-demo.zip')).resolves.toBe('saved');
    expect(written).toHaveLength(1);
  });

  it('falls back to the file input when no open picker exists', async () => {
    delete window.showOpenFilePicker;
    await expect(pickZipFileToImport()).resolves.toBe('fallback');
  });
});

afterEach(() => {
  delete window.showSaveFilePicker;
  delete window.showOpenFilePicker;
});
