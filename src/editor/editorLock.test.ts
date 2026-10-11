import { beforeEach, describe, expect, it } from 'vitest';
import {
  EDITOR_LOCK_STORAGE_KEY,
  EDITOR_SESSION_KEY,
  clearHeldEditorPassword,
  closeEditorSession,
  createAdminCode,
  createEditorLock,
  heldEditorPassword,
  holdEditorPassword,
  isEditorSessionOpen,
  normalizeAdminCode,
  openEditorSession,
  readEditorLock,
  resetEditorPassword,
  verifyAdminCode,
  verifyEditorPassword,
  writeEditorLock,
} from './editorLock';

const password = 'zichtbaar-wachtwoord';
const adminCode = 'WACHT-CODE-BUIT-APPX';

describe('editor lock hashes', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('creates an admin code that can be written down', () => {
    const codes = new Set(Array.from({ length: 5 }, () => createAdminCode()));
    expect(codes.size).toBe(5);
    for (const code of codes) {
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}(?:-[A-HJ-NP-Z2-9]{4}){3}$/);
    }
  });

  it('stores only hashes and rejects a wrong password', async () => {
    const record = await createEditorLock(password, adminCode);
    const stored = JSON.stringify(record);
    expect(Object.keys(record).sort()).toEqual([
      'adminHash',
      'adminSalt',
      'passwordHash',
      'passwordSalt',
    ]);
    expect(stored).not.toContain(password);
    expect(stored).not.toContain(adminCode);
    expect(stored).not.toContain(normalizeAdminCode(adminCode));
    expect(await verifyEditorPassword(record, password)).toBe(true);
    expect(await verifyEditorPassword(record, 'fout-wachtwoord')).toBe(false);
    expect(await verifyEditorPassword(record, '')).toBe(false);
    expect(await verifyAdminCode(record, 'wac ht-code-buit-appx')).toBe(true);
    expect(await verifyAdminCode(record, 'FOUT-CODE')).toBe(false);
  });

  it('resets the editor password and keeps the same admin code', async () => {
    const record = await createEditorLock(password, adminCode);
    expect(await resetEditorPassword(record, 'FOUT-CODE', 'nieuw-wachtwoord')).toBeNull();
    const next = await resetEditorPassword(record, adminCode, 'nieuw-wachtwoord');
    expect(next).not.toBeNull();
    expect(next?.adminHash).toBe(record.adminHash);
    expect(next?.adminSalt).toBe(record.adminSalt);
    expect(next?.passwordHash).not.toBe(record.passwordHash);
    expect(await verifyEditorPassword(record, password)).toBe(true);
    expect(await verifyEditorPassword(next ?? record, password)).toBe(false);
    expect(await verifyEditorPassword(next ?? record, 'nieuw-wachtwoord')).toBe(true);
    expect(await verifyAdminCode(next ?? record, adminCode)).toBe(true);
    expect(writeEditorLock(next ?? record)).toBe(true);
    expect(readEditorLock()).toEqual(next);
    expect(window.localStorage.getItem(EDITOR_LOCK_STORAGE_KEY)).not.toContain(password);
    expect(window.localStorage.getItem(EDITOR_LOCK_STORAGE_KEY)).not.toContain('nieuw-wachtwoord');
  });

  it('ignores a broken lock record and a closed session', () => {
    expect(readEditorLock()).toBeNull();
    expect(isEditorSessionOpen()).toBe(false);
    window.localStorage.setItem(EDITOR_LOCK_STORAGE_KEY, '{kapot');
    expect(readEditorLock()).toBeNull();
    window.localStorage.setItem(EDITOR_LOCK_STORAGE_KEY, JSON.stringify({ passwordHash: 'abc' }));
    expect(readEditorLock()).toBeNull();
    openEditorSession();
    expect(isEditorSessionOpen()).toBe(true);
    closeEditorSession();
    expect(isEditorSessionOpen()).toBe(false);
  });

  it('keeps the editor password only in memory', () => {
    holdEditorPassword(password);
    expect(heldEditorPassword()).toBe(password);
    expect(window.localStorage.getItem(EDITOR_LOCK_STORAGE_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(EDITOR_SESSION_KEY)).toBeNull();
    closeEditorSession();
    expect(heldEditorPassword()).toBe('');
    clearHeldEditorPassword();
  });
});
