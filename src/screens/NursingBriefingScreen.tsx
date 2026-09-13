import { useNavigate } from 'react-router-dom';
import { Screen } from '../components/Screen';
import { copy } from '../content/nl';
import {
  nursingLearningObjectives,
  nursingPatient,
  nursingScenarioMeta,
} from '../nursing/scenario';
import { useAppState } from '../state/AppState';

export function NursingBriefingScreen() {
  const navigate = useNavigate();
  const { nursingSession, startNursing, unlockNursingAudio } = useAppState();

  return (
    <Screen
      title="Scenario: ABCDE en SBAR"
      testId="screen-nursing-briefing"
      footer={
        <>
          <button
            type="button"
            className="btn"
            data-testid="btn-start-nursing-sim"
            onClick={() => {
              if (!nursingSession || nursingSession.status === 'completed') {
                startNursing();
              }
              unlockNursingAudio();
              void navigate('/verpleegkunde/simulatie');
            }}
          >
            Start scenario
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void navigate('/verpleegkunde')}
          >
            {copy.back}
          </button>
        </>
      }
    >
      <section className="card">
        <h2>Patiënt</h2>
        <p>
          <strong>
            {nursingPatient.name}, {String(nursingPatient.age)} jaar
          </strong>{' '}
          <span className="badge">{copy.clientFictional}</span>
        </p>
        <p>{nursingPatient.background}</p>
      </section>
      <section className="card">
        <h2>Context</h2>
        <p>
          {nursingPatient.setting}. {nursingPatient.studentRole}
        </p>
        <p>Geschatte duur: {nursingScenarioMeta.estimatedDuration}.</p>
      </section>
      <section className="card">
        <h2>Leerdoelen</h2>
        <ul className="list">
          {nursingLearningObjectives.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <p className="notice">{copy.fictionalNotice}</p>
    </Screen>
  );
}
