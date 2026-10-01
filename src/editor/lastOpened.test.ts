import { describe, expect, it } from 'vitest';
import { EDITOR_LAST_OPENED_KEY, readLastOpenedModule, writeLastOpenedModule } from './lastOpened';

describe('editor last opened module', () => {
  it('returns null when nothing was opened yet', () => {
    expect(readLastOpenedModule()).toBeNull();
    expect(window.localStorage.getItem(EDITOR_LAST_OPENED_KEY)).toBeNull();
  });

  it('stores Logopedie or Verpleegkunde and ignores broken values', () => {
    writeLastOpenedModule('verpleegkunde');
    expect(readLastOpenedModule()).toBe('verpleegkunde');
    writeLastOpenedModule('logopedie');
    expect(readLastOpenedModule()).toBe('logopedie');
    window.localStorage.setItem(EDITOR_LAST_OPENED_KEY, '{niet-json');
    expect(readLastOpenedModule()).toBeNull();
    window.localStorage.setItem(EDITOR_LAST_OPENED_KEY, JSON.stringify({ module: 'anders' }));
    expect(readLastOpenedModule()).toBeNull();
  });
});
