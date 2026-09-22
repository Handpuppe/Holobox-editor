import { useNavigate } from 'react-router-dom';
import { Screen } from '../components/Screen';
import { copy } from '../content/nl';
import { useAppState } from '../state/AppState';

export function NursingBriefingScreen() {
  const navigate = useNavigate();
  const { nursingSession, nursingScenario, startNursing, unlockNursingAudio } = useAppState();
  const { patient, learningObjectives, meta } = nursingScenario;

  return (
    <Screen
      title={meta.title || 'Scenario: ABCDE en SBAR'}
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
            {patient.name}, {String(patient.age)} jaar
          </strong>{' '}
          <span className="badge">{copy.clientFictional}</span>
        </p>
        <p>{patient.background}</p>
      </section>
      <section className="card">
        <h2>Context</h2>
        <p>
          {patient.setting}. {patient.studentRole}
        </p>
        <p>Geschatte duur: {meta.estimatedDuration}.</p>
      </section>
      <section className="card">
        <h2>Leerdoelen</h2>
        <ul className="list">
          {learningObjectives.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <p className="notice">{copy.fictionalNotice}</p>
    </Screen>
  );
}
