import { describe, expect, it } from 'vitest';
import {
  avatarSourceChain,
  avatarVariantFor,
  AVATAR_FILES,
  LOGOPEDIE_BASIS_PATH,
  publicResourceUrl,
} from './resolveAvatar';

describe('logopedie avatar variants', () => {
  it('maps each emotion to a static still', () => {
    expect(avatarVariantFor('neutral')).toBe('onzeker');
    expect(avatarVariantFor('listening')).toBe('luistert');
    expect(avatarVariantFor('thinking')).toBe('woordzoekend');
    expect(avatarVariantFor('confused')).toBe('verward');
    expect(avatarVariantFor('frustrated')).toBe('gefrustreerd');
    expect(avatarVariantFor('reassured')).toBe('opgelucht');
    expect(avatarVariantFor('speaking')).toBe('luistert');
  });

  it('falls back through onzeker, neutraal, erik_basis, then SVG', () => {
    const thinking = avatarSourceChain('thinking');
    expect(thinking.map((item) => item.variant)).toEqual([
      'woordzoekend',
      'onzeker',
      'neutraal',
      'basis',
      'legacy',
    ]);
    expect(thinking[0]?.relativePath).toBe(AVATAR_FILES.woordzoekend);
    expect(thinking[1]?.relativePath).toBe(AVATAR_FILES.onzeker);

    const rest = avatarSourceChain('neutral');
    expect(rest.map((item) => item.variant)).toEqual(['onzeker', 'neutraal', 'basis', 'legacy']);
    expect(rest[0]?.relativePath).toBe(AVATAR_FILES.onzeker);
    expect(rest[2]?.relativePath).toBe(LOGOPEDIE_BASIS_PATH);
    expect(publicResourceUrl(AVATAR_FILES.luistert)).toMatch(
      /\/resources\/logopedie\/avatar\/generated\/erik\/luistert\.png$/,
    );
  });
});
