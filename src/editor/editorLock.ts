export const EDITOR_LOCK_STORAGE_KEY = 'phosaner-editor-lock';
export const EDITOR_SESSION_KEY = 'phosaner-editor-unlocked';

const ADMIN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export interface EditorLockRecord {
  passwordHash: string;
  passwordSalt: string;
  adminHash: string;
  adminSalt: string;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/.test(hex)) {
    return null;
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function isHex(value: unknown, byteLength: number): value is string {
  return typeof value === 'string' && value.length === byteLength * 2 && /^[0-9a-f]+$/.test(value);
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

async function digestHex(bytes: Uint8Array): Promise<string> {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return bytesToHex(new Uint8Array(digest));
}

async function hashSecret(
  secret: string,
  salt = randomBytes(16),
): Promise<{ salt: string; hash: string }> {
  const secretBytes = new TextEncoder().encode(secret);
  const combined = new Uint8Array(salt.length + secretBytes.length);
  combined.set(salt, 0);
  combined.set(secretBytes, salt.length);
  return { salt: bytesToHex(salt), hash: await digestHex(combined) };
}

function sameHex(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

export function normalizeAdminCode(value: string): string {
  return value.replace(/[\s-]+/g, '').toUpperCase();
}

async function verifySecret(
  secret: string,
  saltHex: string,
  expectedHash: string,
): Promise<boolean> {
  const salt = hexToBytes(saltHex);
  if (!salt || !isHex(expectedHash, 32)) {
    return false;
  }
  const next = await hashSecret(secret, salt);
  return sameHex(next.hash, expectedHash);
}

export function createAdminCode(): string {
  const bytes = randomBytes(16);
  let raw = '';
  for (const byte of bytes) {
    raw += ADMIN_ALPHABET[byte % ADMIN_ALPHABET.length] ?? 'A';
  }
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
}

export async function createEditorLock(
  password: string,
  adminCode: string,
): Promise<EditorLockRecord> {
  const passwordParts = await hashSecret(password);
  const adminParts = await hashSecret(normalizeAdminCode(adminCode));
  return {
    passwordHash: passwordParts.hash,
    passwordSalt: passwordParts.salt,
    adminHash: adminParts.hash,
    adminSalt: adminParts.salt,
  };
}

export function readEditorLock(): EditorLockRecord | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(EDITOR_LOCK_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const data = JSON.parse(raw) as Partial<EditorLockRecord>;
    if (
      !isHex(data.passwordHash, 32) ||
      !isHex(data.adminHash, 32) ||
      !isHex(data.passwordSalt, 16) ||
      !isHex(data.adminSalt, 16)
    ) {
      return null;
    }
    return {
      passwordHash: data.passwordHash,
      passwordSalt: data.passwordSalt,
      adminHash: data.adminHash,
      adminSalt: data.adminSalt,
    };
  } catch {
    return null;
  }
}

export function writeEditorLock(record: EditorLockRecord): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    const stored = JSON.stringify(record);
    window.localStorage.setItem(EDITOR_LOCK_STORAGE_KEY, stored);
    return window.localStorage.getItem(EDITOR_LOCK_STORAGE_KEY) === stored;
  } catch {
    return false;
  }
}

export async function verifyEditorPassword(
  record: EditorLockRecord,
  password: string,
): Promise<boolean> {
  if (password.length === 0) {
    return false;
  }
  return verifySecret(password, record.passwordSalt, record.passwordHash);
}

export async function verifyAdminCode(
  record: EditorLockRecord,
  adminCode: string,
): Promise<boolean> {
  const normalized = normalizeAdminCode(adminCode);
  if (normalized.length === 0) {
    return false;
  }
  return verifySecret(normalized, record.adminSalt, record.adminHash);
}

export async function resetEditorPassword(
  record: EditorLockRecord,
  adminCode: string,
  newPassword: string,
): Promise<EditorLockRecord | null> {
  if (newPassword.length === 0 || !(await verifyAdminCode(record, adminCode))) {
    return null;
  }
  const passwordParts = await hashSecret(newPassword);
  return {
    passwordHash: passwordParts.hash,
    passwordSalt: passwordParts.salt,
    adminHash: record.adminHash,
    adminSalt: record.adminSalt,
  };
}

export function isEditorSessionOpen(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return window.sessionStorage.getItem(EDITOR_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function openEditorSession(): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.sessionStorage.setItem(EDITOR_SESSION_KEY, '1');
  } catch {
    // Zonder sessie vraagt de volgende start opnieuw om het wachtwoord.
  }
}

let heldEditorPasswordValue = '';

export function holdEditorPassword(password: string): void {
  heldEditorPasswordValue = password;
}

export function heldEditorPassword(): string {
  return heldEditorPasswordValue;
}

export function clearHeldEditorPassword(): void {
  heldEditorPasswordValue = '';
}

export function closeEditorSession(): void {
  clearHeldEditorPassword();
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.sessionStorage.removeItem(EDITOR_SESSION_KEY);
  } catch {
    // Een gesloten sessie blijft dicht.
  }
}
