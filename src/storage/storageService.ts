import { EMPTY_NOTES } from '../domain/notes';
import {
  STORAGE_SCHEMA_VERSION,
  type SavedResult,
  type SimulationSession,
  type StorageSchema,
} from '../domain/types';
import { defaultTeacherSettings } from '../media/teacherDefaults';
import type { NursingSession } from '../nursing/types';

export const STORAGE_KEY = 'holobox-zorgsimulator-v2';
export const LEGACY_STORAGE_KEY = 'holobox-speech-therapy-v1';

const emptyStore = (): StorageSchema => ({
  schemaVersion: STORAGE_SCHEMA_VERSION,
  unfinishedLogopedie: null,
  unfinishedNursing: null,
  results: [],
  teacher: defaultTeacherSettings(),
  audio: { muted: false, volume: 0.8 },
});

export function canUseStorage(): boolean {
  try {
    const key = `${STORAGE_KEY}::probe`;
    window.localStorage.setItem(key, '1');
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSession(value: unknown): value is SimulationSession {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.currentNodeId === 'string' &&
    typeof value.status === 'string' &&
    Array.isArray(value.history)
  );
}

function isNursingSession(value: unknown): value is NursingSession {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.currentStepId === 'string' &&
    typeof value.status === 'string' &&
    Array.isArray(value.history)
  );
}

function isSavedResult(value: unknown): value is SavedResult {
  return isObject(value) && typeof value.id === 'string' && isObject(value.score);
}

function migrateResult(value: SavedResult): SavedResult {
  return {
    ...value,
    module: value.module === 'verpleegkunde' ? 'verpleegkunde' : 'logopedie',
    notes: value.notes ?? EMPTY_NOTES,
    conclusion: value.conclusion ?? null,
    criticalErrors: Array.isArray(value.criticalErrors) ? value.criticalErrors : [],
    completedParts: Array.isArray(value.completedParts) ? value.completedParts : [],
    flags: value.flags ?? {
      gaveResponseTime: false,
      finishedSentences: false,
      usedLongQuestions: false,
      exploredParticipation: false,
      acknowledgedFrustration: false,
      usedAssumptions: false,
      addressedClientDirectly: false,
      offeredCommunicationSupport: false,
    },
  };
}

function migrateUnknown(parsed: Record<string, unknown>): StorageSchema {
  const version = parsed.schemaVersion;
  if (version === 2) {
    const results = Array.isArray(parsed.results)
      ? parsed.results.filter(isSavedResult).map(migrateResult)
      : [];
    const unfinishedLogopedie =
      parsed.unfinishedLogopedie === null || isSession(parsed.unfinishedLogopedie)
        ? (parsed.unfinishedLogopedie as SimulationSession | null)
        : isSession(parsed.unfinishedSession)
          ? parsed.unfinishedSession
          : null;
    const unfinishedNursing =
      parsed.unfinishedNursing === null || isNursingSession(parsed.unfinishedNursing)
        ? (parsed.unfinishedNursing as NursingSession | null)
        : null;
    return {
      schemaVersion: 2,
      unfinishedLogopedie,
      unfinishedNursing,
      results,
      teacher: isObject(parsed.teacher)
        ? { ...defaultTeacherSettings(), ...parsed.teacher }
        : defaultTeacherSettings(),
      audio:
        isObject(parsed.audio) && typeof parsed.audio.volume === 'number'
          ? { muted: Boolean(parsed.audio.muted), volume: parsed.audio.volume }
          : { muted: false, volume: 0.8 },
    };
  }
  if (version === 1) {
    const results = Array.isArray(parsed.results)
      ? parsed.results.filter(isSavedResult).map(migrateResult)
      : [];
    return {
      schemaVersion: 2,
      unfinishedLogopedie: isSession(parsed.unfinishedSession) ? parsed.unfinishedSession : null,
      unfinishedNursing: null,
      results,
      teacher: defaultTeacherSettings(),
      audio: { muted: false, volume: 0.8 },
    };
  }
  return emptyStore();
}

export function parseStoragePayload(raw: string | null): {
  ok: boolean;
  reason?: string;
  data: StorageSchema;
} {
  if (raw === null || raw.trim() === '') {
    return { ok: true, data: emptyStore() };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed)) {
      return { ok: false, reason: 'corrupted', data: emptyStore() };
    }
    if (parsed.schemaVersion !== 1 && parsed.schemaVersion !== 2) {
      return { ok: false, reason: 'unsupported-schema', data: emptyStore() };
    }
    return { ok: true, data: migrateUnknown(parsed) };
  } catch {
    return { ok: false, reason: 'corrupted', data: emptyStore() };
  }
}

export class StorageService {
  private readonly storage: Storage | null;

  constructor(storage: Storage | null) {
    this.storage = storage;
  }

  get available(): boolean {
    return this.storage !== null;
  }

  read(): { ok: boolean; reason?: string; data: StorageSchema; available: boolean } {
    if (!this.storage) {
      return { ok: false, reason: 'unavailable', data: emptyStore(), available: false };
    }
    try {
      const current = this.storage.getItem(STORAGE_KEY);
      if (current) {
        return { ...parseStoragePayload(current), available: true };
      }
      const legacy = this.storage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        const migrated = parseStoragePayload(legacy);
        this.write(migrated.data);
        return { ...migrated, available: true };
      }
      return { ok: true, data: emptyStore(), available: true };
    } catch {
      return { ok: false, reason: 'unavailable', data: emptyStore(), available: false };
    }
  }

  write(data: StorageSchema): boolean {
    if (!this.storage) {
      return false;
    }
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  saveLogopedieUnfinished(session: SimulationSession | null): boolean {
    const current = this.read().data;
    return this.write({ ...current, unfinishedLogopedie: session });
  }

  saveNursingUnfinished(session: NursingSession | null): boolean {
    const current = this.read().data;
    return this.write({ ...current, unfinishedNursing: session });
  }

  saveTeacher(teacher: StorageSchema['teacher']): boolean {
    const current = this.read().data;
    return this.write({ ...current, teacher });
  }

  saveAudio(audio: StorageSchema['audio']): boolean {
    const current = this.read().data;
    return this.write({ ...current, audio });
  }

  saveResult(result: SavedResult): boolean {
    const current = this.read().data;
    const results = [result, ...current.results.filter((item) => item.id !== result.id)];
    return this.write({
      ...current,
      unfinishedLogopedie: result.module === 'logopedie' ? null : current.unfinishedLogopedie,
      unfinishedNursing: result.module === 'verpleegkunde' ? null : current.unfinishedNursing,
      results,
    });
  }

  deleteResult(id: string): boolean {
    const current = this.read().data;
    return this.write({
      ...current,
      results: current.results.filter((item) => item.id !== id),
    });
  }
}

export function createStorageService(): StorageService {
  if (typeof window === 'undefined') {
    return new StorageService(null);
  }
  try {
    if (!canUseStorage()) {
      return new StorageService(null);
    }
    return new StorageService(window.localStorage);
  } catch {
    return new StorageService(null);
  }
}
