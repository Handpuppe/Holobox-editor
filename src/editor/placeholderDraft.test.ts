import { describe, expect, it } from 'vitest';
import { placeholderDraft, syncPlaceholderDraft } from './placeholderDraft';

describe('placeholder draft sync', () => {
  it('replaces an untouched empty field when the same question loads from the file', () => {
    const initial = placeholderDraft('n-1-high', '');
    const synced = syncPlaceholderDraft(initial, 'n-1-high', 'Vrouw knikt en ademt uit.');
    expect(synced?.text).toBe('Vrouw knikt en ademt uit.');
    expect(synced?.saved).toBe(true);
  });

  it('keeps text the user is typing when the stored text changes underneath', () => {
    const typing = { ...placeholderDraft('n-1', ''), text: 'Startfilm' };
    const synced = syncPlaceholderDraft(typing, 'n-1', 'Andere tekst uit het bestand');
    expect(synced?.text).toBe('Startfilm');
    expect(synced?.source).toBe('Andere tekst uit het bestand');
  });
});
