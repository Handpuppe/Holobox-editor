/** Lokale tekst van een placeholderveld. source is de laatst geziene tekst uit het scenario. */
export interface PlaceholderDraft {
  key: string;
  text: string;
  saved: boolean;
  source: string;
}

export function placeholderDraft(key: string, stored: string): PlaceholderDraft {
  return {
    key,
    text: stored,
    saved: stored.trim().length > 0,
    source: stored,
  };
}

/**
 * Neemt tekst uit het scenario over wanneer het veld nog niet is aangepast.
 * Na herstart blijft de vraag-id gelijk; de lege startkopie mag de opgeslagen tekst dan niet vasthouden.
 * Een tekst die de gebruiker net typt blijft staan.
 */
export function syncPlaceholderDraft(
  state: PlaceholderDraft,
  key: string,
  stored: string,
): PlaceholderDraft | null {
  if (state.key !== key) {
    return placeholderDraft(key, stored);
  }
  if (state.source === stored) {
    return null;
  }
  if (state.text !== state.source) {
    return { ...state, source: stored };
  }
  return placeholderDraft(key, stored);
}
