import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react';
import { aphasiaIntakeScenario } from '../data/aphasiaIntakeScenario';
import { resolveLogopedieScenario } from '../data/loadLogopedieScenario';
import { resolveNursingScenario } from '../data/loadNursingScenario';
import { buildFeedback } from '../domain/feedback';
import { emptyFlags } from '../domain/notes';
import { calculateScores } from '../domain/scoring';
import { assertValidScenario, ScenarioValidationError } from '../domain/scenarioValidation';
import { activeDurationMs, createSession } from '../domain/session';
import type {
  AudioPreferences,
  SavedResult,
  Scenario,
  SimulationSession,
  StorageSchema,
} from '../domain/types';
import { clampTeacherSettings, defaultTeacherSettings } from '../media/teacherDefaults';
import type { TeacherSettings } from '../media/types';
import { nursingReducer } from '../nursing/reducer';
import { calculateNursingScores, toGenericEvents } from '../nursing/scoring';
import { builtInNursingScenario } from '../nursing/scenario';
import { createNursingSession } from '../nursing/session';
import type { NursingScenario, NursingSession } from '../nursing/types';
import { createStorageService, type StorageService } from '../storage/storageService';
import { simulationReducer } from './simulationReducer';

function logopedieResult(session: SimulationSession, scenario: Scenario): SavedResult {
  const score = calculateScores(session.history, scenario);
  return {
    id: session.id,
    schemaVersion: session.schemaVersion,
    savedAt: new Date().toISOString(),
    appVersion: session.appVersion,
    module: 'logopedie',
    scenarioId: session.scenarioId,
    scenarioVersion: session.scenarioVersion,
    rubricVersion: session.rubricVersion,
    durationMs: activeDurationMs(session),
    score,
    history: session.history,
    notes: session.notes,
    conclusion: session.conclusion,
    feedback: buildFeedback(session.history, scenario, score),
    flags: session.flags,
    criticalErrors: session.history
      .filter((event) => event.unsafe)
      .map((event) => event.delayedFeedback),
    completedParts: session.history.map((event) => event.nodeId),
  };
}

function nursingResult(session: NursingSession, nursing: NursingScenario): SavedResult {
  const score = calculateNursingScores(session.history, nursing.steps);
  const timeline = session.history.map((event) => {
    const step = nursing.steps.find((item) => item.id === event.stepId);
    const option = step?.options.find((item) => item.id === event.optionId);
    return {
      nodeId: event.stepId,
      phaseLabel: step?.phaseLabel ?? event.stepId,
      choice: option?.text ?? event.optionId,
      quality: event.quality,
    };
  });
  return {
    id: session.id,
    schemaVersion: session.schemaVersion,
    savedAt: new Date().toISOString(),
    appVersion: session.appVersion,
    module: 'verpleegkunde',
    scenarioId: session.scenarioId,
    scenarioVersion: session.scenarioVersion,
    rubricVersion: session.rubricVersion,
    durationMs:
      session.status === 'completed' || session.status === 'paused'
        ? session.accumulatedActiveMs
        : session.accumulatedActiveMs +
          Math.max(0, Date.now() - Date.parse(session.lastResumedAt || session.startedAt)),
    score,
    history: toGenericEvents(session.history),
    notes: {
      presentingConcern: session.sbar.situation,
      languageAndCommunication: '',
      dailyParticipation: '',
      psychosocialFactors: '',
      observations: session.sbar.assessment,
      possibleNextSteps: session.sbar.recommendation,
    },
    conclusion: null,
    feedback: {
      strengths: session.history
        .filter((event) => event.quality === 'high')
        .map((event) => event.delayedFeedback)
        .slice(0, 3),
      improvements: session.history
        .filter((event) => event.quality !== 'high')
        .map((event) => event.delayedFeedback)
        .slice(0, 3),
      timeline,
      keyDecisions: session.history.map((event) => event.educationalRationale).slice(0, 8),
      observationVersusAssumption:
        session.history.find((event) => event.unsafe)?.delayedFeedback ??
        'Je hebt waarneming en interpretatie grotendeels gescheiden gehouden.',
      strongerApproach: 'Volg ABCDE, blijf bij de patiënt en rond SBAR closed-loop af.',
    },
    flags: emptyFlags(),
    criticalErrors: session.criticalErrors,
    completedParts: session.history.map((event) => event.stepId),
  };
}

interface AppContextValue {
  scenario: Scenario;
  nursingScenario: NursingScenario;
  overlayReady: boolean;
  scenarioValid: boolean;
  scenarioIssues: string[];
  storage: StorageService;
  storageAvailable: boolean;
  storageNotice: string | null;
  store: StorageSchema;
  session: SimulationSession | null;
  nursingSession: NursingSession | null;
  teacher: TeacherSettings;
  audio: AudioPreferences;
  audioBlocked: boolean;
  setAudioBlocked: (value: boolean) => void;
  startNewSession: () => SimulationSession;
  dispatchSelect: (optionId: string) => void;
  completeTransition: () => void;
  pause: () => void;
  resume: () => void;
  endEarly: () => void;
  saveNotes: (notes: SimulationSession['notes']) => void;
  submitConclusion: (conclusion: NonNullable<SimulationSession['conclusion']>) => SavedResult;
  saveCurrentResult: () => SavedResult | null;
  deleteResult: (id: string) => void;
  discardSession: () => void;
  startNursing: () => NursingSession;
  selectNursing: (optionId: string) => void;
  pauseNursing: () => void;
  resumeNursing: () => void;
  discardNursing: () => void;
  unlockNursingAudio: () => void;
  saveNursingResult: () => SavedResult | null;
  saveTeacher: (settings: TeacherSettings) => void;
  saveAudio: (audio: AudioPreferences) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function validateBoot(): { ok: boolean; issues: string[] } {
  try {
    assertValidScenario(aphasiaIntakeScenario);
    return { ok: true, issues: [] };
  } catch (error) {
    if (error instanceof ScenarioValidationError) {
      return { ok: false, issues: error.issues };
    }
    return { ok: false, issues: ['Onbekende configuratiefout.'] };
  }
}

function startLogopedieSession(scenario: Scenario): SimulationSession {
  try {
    return createSession(scenario);
  } catch {
    return createSession(aphasiaIntakeScenario);
  }
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const boot = useMemo(() => validateBoot(), []);
  const storage = useMemo(() => createStorageService(), []);
  const initialRead = useMemo(() => storage.read(), [storage]);
  const [scenario, setScenario] = useState<Scenario>(aphasiaIntakeScenario);
  const [nursingScenario, setNursingScenario] = useState<NursingScenario>(builtInNursingScenario);
  const [overlayReady, setOverlayReady] = useState(() => import.meta.env.MODE === 'test');
  const [store, setStore] = useState<StorageSchema>(initialRead.data);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [storageNotice] = useState<string | null>(() => {
    if (!initialRead.available) {
      return 'unavailable';
    }
    if (!initialRead.ok) {
      return initialRead.reason ?? 'corrupted';
    }
    return null;
  });
  const [session, dispatch] = useReducer(simulationReducer, initialRead.data.unfinishedLogopedie);
  const [nursingSession, dispatchNursing] = useReducer(
    nursingReducer,
    initialRead.data.unfinishedNursing,
  );

  useEffect(() => {
    if (import.meta.env.MODE === 'test') {
      return;
    }
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (!cancelled) {
        setOverlayReady(true);
      }
    }, 2500);
    void Promise.all([resolveLogopedieScenario(), resolveNursingScenario()])
      .then(([loadedLogopedie, loadedNursing]) => {
        if (cancelled) {
          return;
        }
        setScenario(loadedLogopedie.scenario);
        setNursingScenario(loadedNursing.scenario);
        setOverlayReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setScenario(aphasiaIntakeScenario);
          setNursingScenario(builtInNursingScenario);
          setOverlayReady(true);
        }
      })
      .finally(() => {
        window.clearTimeout(timeout);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    storage.saveLogopedieUnfinished(session);
  }, [session, storage]);

  useEffect(() => {
    storage.saveNursingUnfinished(nursingSession);
  }, [nursingSession, storage]);

  const value = useMemo<AppContextValue>(
    () => ({
      scenario,
      nursingScenario,
      overlayReady,
      scenarioValid: boot.ok,
      scenarioIssues: boot.issues,
      storage,
      storageAvailable: storage.available,
      storageNotice,
      store,
      session,
      nursingSession,
      teacher: clampTeacherSettings(store.teacher ?? defaultTeacherSettings()),
      audio: store.audio ?? { muted: false, volume: 0.8 },
      audioBlocked,
      setAudioBlocked,
      startNewSession: () => {
        const next = startLogopedieSession(scenario);
        dispatch({ type: 'start', session: next });
        return next;
      },
      dispatchSelect: (optionId: string) => {
        dispatch({
          type: 'select-option',
          optionId,
          scenario,
          at: new Date().toISOString(),
        });
      },
      completeTransition: () => {
        dispatch({ type: 'complete-transition', scenario });
      },
      pause: () => dispatch({ type: 'pause', at: new Date().toISOString() }),
      resume: () => dispatch({ type: 'resume', at: new Date().toISOString() }),
      endEarly: () => dispatch({ type: 'end-early', at: new Date().toISOString() }),
      saveNotes: (notes) => dispatch({ type: 'save-notes', notes }),
      submitConclusion: (conclusion) => {
        const at = new Date().toISOString();
        dispatch({ type: 'submit-conclusion', conclusion, scenario, at });
        const completed = simulationReducer(session, {
          type: 'submit-conclusion',
          conclusion,
          scenario,
          at,
        });
        if (!completed) {
          throw new Error('Geen sessie om af te ronden.');
        }
        return logopedieResult(completed, scenario);
      },
      saveCurrentResult: () => {
        if (!session || session.status !== 'completed') {
          return null;
        }
        const result = logopedieResult(session, scenario);
        storage.saveResult(result);
        setStore(storage.read().data);
        return result;
      },
      deleteResult: (id: string) => {
        storage.deleteResult(id);
        setStore(storage.read().data);
      },
      discardSession: () => {
        dispatch({ type: 'clear' });
        storage.saveLogopedieUnfinished(null);
        setStore(storage.read().data);
      },
      startNursing: () => {
        const next = createNursingSession(new Date(), nursingScenario.meta);
        dispatchNursing({ type: 'start', session: next });
        return next;
      },
      selectNursing: (optionId: string) => {
        dispatchNursing({
          type: 'select',
          optionId,
          at: new Date().toISOString(),
          steps: nursingScenario.steps,
        });
      },
      pauseNursing: () => dispatchNursing({ type: 'pause', at: new Date().toISOString() }),
      resumeNursing: () => dispatchNursing({ type: 'resume', at: new Date().toISOString() }),
      discardNursing: () => {
        dispatchNursing({ type: 'clear' });
        storage.saveNursingUnfinished(null);
        setStore(storage.read().data);
      },
      unlockNursingAudio: () => dispatchNursing({ type: 'unlock-audio' }),
      saveNursingResult: () => {
        if (!nursingSession || nursingSession.status !== 'completed') {
          return null;
        }
        const result = nursingResult(nursingSession, nursingScenario);
        storage.saveResult(result);
        setStore(storage.read().data);
        return result;
      },
      saveTeacher: (settings: TeacherSettings) => {
        const next = clampTeacherSettings(settings);
        storage.saveTeacher(next);
        setStore(storage.read().data);
      },
      saveAudio: (audio: AudioPreferences) => {
        storage.saveAudio(audio);
        setStore(storage.read().data);
      },
    }),
    [
      audioBlocked,
      boot.issues,
      boot.ok,
      nursingSession,
      nursingScenario,
      overlayReady,
      scenario,
      session,
      storage,
      storageNotice,
      store,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) {
    throw new Error('AppState ontbreekt.');
  }
  return value;
}
