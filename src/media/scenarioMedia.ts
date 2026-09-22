import type { MediaSlotConfig } from './types';

const AIRWAY = 'verpleegkunde/Staat is Mogelijk bedreigde luchtweg – A (Airway).mp4';
const DYSPNEA = 'verpleegkunde/Staat is benauwd.mp4';
const OXYGEN = 'verpleegkunde/Staat is zuurstof te kort.mp4';
const HYPER = 'verpleegkunde/Staat is hyperventileren.mp4';
const CIRC = 'verpleegkunde/Staat is Bleek en klam.mp4';
const DISABILITY = 'verpleegkunde/Staat is Verminderde bewustzijn.mp4';
const RASH =
  'verpleegkunde/Staat is Huiduitslag of mogelijke allergische reactie – E (ExposureEnvironment).mp4';
const FEVER = 'verpleegkunde/Staat is koorts.mp4';
const PAIN = 'verpleegkunde/Staat is pijn.mp4';

export const NURSING_SCENARIO_ID = 'abcde-sbar-sara-meijer';

export const mediaSlots: MediaSlotConfig[] = [
  {
    slotId: 'nursing-airway',
    scenarioId: NURSING_SCENARIO_ID,
    module: 'verpleegkunde',
    matchedKeywords: ['luchtweg', 'airway', 'bedreigde'],
    primaryMedia: AIRWAY,
    idleMedia: null,
    posterImage: null,
    transcript:
      'Observatie A: de patiënt staat, de luchtweg lijkt mogelijk bedreigd. Beoordeel of spreken en ademen vrij zijn.',
    captions: 'Mogelijke bedreiging van de luchtweg. Dit is een fictieve onderwijssituatie.',
    alternativeMatches: [],
    loopBehaviour: 'none',
    audioEnabled: true,
    studentLabel: 'Observatie luchtweg',
  },
  {
    slotId: 'nursing-breathing',
    scenarioId: NURSING_SCENARIO_ID,
    module: 'verpleegkunde',
    matchedKeywords: ['benauwd'],
    primaryMedia: DYSPNEA,
    idleMedia: null,
    posterImage: null,
    transcript:
      'Observatie B: de patiënt is zichtbaar benauwd. Let op ademarbeid zonder een diagnose te stellen.',
    captions: 'Benauwdheid. Fictieve onderwijssituatie.',
    alternativeMatches: [OXYGEN, HYPER],
    loopBehaviour: 'none',
    audioEnabled: true,
    studentLabel: 'Observatie ademhaling',
  },
  {
    slotId: 'nursing-oxygen',
    scenarioId: NURSING_SCENARIO_ID,
    module: 'verpleegkunde',
    matchedKeywords: ['zuurstof'],
    primaryMedia: OXYGEN,
    idleMedia: null,
    posterImage: null,
    transcript:
      'Aanvullende observatie: mogelijke tekenen van zuurstoftekort. Meet en rapporteer, interpreteer niet te zwaar.',
    captions: 'Mogelijke tekenen van zuurstoftekort. Fictieve onderwijssituatie.',
    alternativeMatches: [DYSPNEA],
    loopBehaviour: 'none',
    audioEnabled: true,
    studentLabel: 'Observatie oxygenatie',
  },
  {
    slotId: 'nursing-hyperventilation',
    scenarioId: NURSING_SCENARIO_ID,
    module: 'verpleegkunde',
    matchedKeywords: ['hyperventileren'],
    primaryMedia: HYPER,
    idleMedia: null,
    posterImage: null,
    transcript:
      'Aanvullende observatie: de ademhaling kan snel en oppervlakkig zijn. Beschrijf wat je ziet.',
    captions: 'Snelle ademhaling. Fictieve onderwijssituatie.',
    alternativeMatches: [DYSPNEA],
    loopBehaviour: 'none',
    audioEnabled: true,
    studentLabel: 'Observatie adempatroon',
  },
  {
    slotId: 'nursing-circulation',
    scenarioId: NURSING_SCENARIO_ID,
    module: 'verpleegkunde',
    matchedKeywords: ['bleek', 'klam'],
    primaryMedia: CIRC,
    idleMedia: null,
    posterImage: null,
    transcript:
      'Observatie C: de huid kan bleek en klam aanvoelen. Beoordeel circulatie systematisch.',
    captions: 'Bleke, klamme huid. Fictieve onderwijssituatie.',
    alternativeMatches: [],
    loopBehaviour: 'none',
    audioEnabled: true,
    studentLabel: 'Observatie circulatie',
  },
  {
    slotId: 'nursing-disability',
    scenarioId: NURSING_SCENARIO_ID,
    module: 'verpleegkunde',
    matchedKeywords: ['bewustzijn', 'verminderde'],
    primaryMedia: DISABILITY,
    idleMedia: null,
    posterImage: null,
    transcript:
      'Observatie D: het bewustzijn kan verminderd zijn. Spreek de patiënt aan en beoordeel de reactie.',
    captions: 'Verminderd bewustzijn. Fictieve onderwijssituatie.',
    alternativeMatches: [],
    loopBehaviour: 'none',
    audioEnabled: true,
    studentLabel: 'Observatie bewustzijn',
  },
  {
    slotId: 'nursing-exposure',
    scenarioId: NURSING_SCENARIO_ID,
    module: 'verpleegkunde',
    matchedKeywords: ['huiduitslag', 'allergische', 'exposureenvironment'],
    primaryMedia: RASH,
    idleMedia: null,
    posterImage: null,
    transcript:
      'Observatie E: er kan huiduitslag zichtbaar zijn, passend bij een mogelijke allergische reactie. Stel geen zekere diagnose.',
    captions: 'Huiduitslag, mogelijke allergische reactie. Fictieve onderwijssituatie.',
    alternativeMatches: [FEVER, PAIN],
    loopBehaviour: 'none',
    audioEnabled: true,
    studentLabel: 'Observatie huid en omgeving',
  },
  {
    slotId: 'nursing-fever',
    scenarioId: NURSING_SCENARIO_ID,
    module: 'verpleegkunde',
    matchedKeywords: ['koorts'],
    primaryMedia: FEVER,
    idleMedia: null,
    posterImage: null,
    transcript:
      'Aanvullende observatie: let op tekenen van koorts zonder andere ABCDE-bevindingen te negeren.',
    captions: 'Mogelijke koorts. Fictieve onderwijssituatie.',
    alternativeMatches: [RASH],
    loopBehaviour: 'none',
    audioEnabled: true,
    studentLabel: 'Observatie temperatuur',
  },
  {
    slotId: 'nursing-pain',
    scenarioId: NURSING_SCENARIO_ID,
    module: 'verpleegkunde',
    matchedKeywords: ['pijn'],
    primaryMedia: PAIN,
    idleMedia: null,
    posterImage: null,
    transcript:
      'Aanvullende observatie: de patiënt kan pijn aangeven. Pijn mag ABCDE niet verdringen.',
    captions: 'Pijn. Fictieve onderwijssituatie.',
    alternativeMatches: [RASH],
    loopBehaviour: 'none',
    audioEnabled: true,
    studentLabel: 'Observatie pijn',
  },
];

export function slotById(
  slotId: string,
  slots: MediaSlotConfig[] = mediaSlots,
): MediaSlotConfig | undefined {
  return slots.find((slot) => slot.slotId === slotId);
}
