import { NOTES_MAX_LENGTH, type StudentNotes } from './types';
import { sanitizeMultiline } from './sanitize';

export const EMPTY_NOTES: StudentNotes = {
  presentingConcern: '',
  languageAndCommunication: '',
  dailyParticipation: '',
  psychosocialFactors: '',
  observations: '',
  possibleNextSteps: '',
};

export const NOTE_FIELDS: Array<{ id: keyof StudentNotes; label: string; hint: string }> = [
  {
    id: 'presentingConcern',
    label: 'Hulpvraag',
    hint: 'Wat brengt de cliënt, in zijn eigen woorden?',
  },
  {
    id: 'languageAndCommunication',
    label: 'Taal en communicatie',
    hint: 'Wat observeer je in begrip, woordvinding en uiting?',
  },
  {
    id: 'dailyParticipation',
    label: 'Dagelijkse participatie',
    hint: 'Thuis, gezin, werk, vrije tijd.',
  },
  {
    id: 'psychosocialFactors',
    label: 'Psychosociale factoren',
    hint: 'Emotie, vermoeidheid, steun, onzekerheid.',
  },
  {
    id: 'observations',
    label: 'Observaties',
    hint: 'Alleen wat je waarneemt, geen aannames.',
  },
  {
    id: 'possibleNextSteps',
    label: 'Mogelijke vervolgstappen',
    hint: 'Voorzichtige ideeën voor het vervolg.',
  },
];

export function sanitizeNotes(notes: StudentNotes): StudentNotes {
  return {
    presentingConcern: sanitizeMultiline(notes.presentingConcern, NOTES_MAX_LENGTH),
    languageAndCommunication: sanitizeMultiline(notes.languageAndCommunication, NOTES_MAX_LENGTH),
    dailyParticipation: sanitizeMultiline(notes.dailyParticipation, NOTES_MAX_LENGTH),
    psychosocialFactors: sanitizeMultiline(notes.psychosocialFactors, NOTES_MAX_LENGTH),
    observations: sanitizeMultiline(notes.observations, NOTES_MAX_LENGTH),
    possibleNextSteps: sanitizeMultiline(notes.possibleNextSteps, NOTES_MAX_LENGTH),
  };
}

export function emptyFlags() {
  return {
    gaveResponseTime: false,
    finishedSentences: false,
    usedLongQuestions: false,
    exploredParticipation: false,
    acknowledgedFrustration: false,
    usedAssumptions: false,
    addressedClientDirectly: false,
    offeredCommunicationSupport: false,
  };
}
