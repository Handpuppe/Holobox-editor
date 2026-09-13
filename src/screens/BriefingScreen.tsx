import { useNavigate } from 'react-router-dom';
import { Screen } from '../components/Screen';
import { copy } from '../content/nl';
import { aphasiaIntakeScenario } from '../data/aphasiaIntakeScenario';
import { useAppState } from '../state/AppState';

export function BriefingScreen() {
  const navigate = useNavigate();
  const { session, startNewSession } = useAppState();
  const scenario = aphasiaIntakeScenario;

  return (
    <Screen
      title="Scenario: intake bij afasie"
      testId="screen-briefing"
      footer={
        <>
          <button
            type="button"
            className="btn"
            data-testid="btn-start-intake"
            onClick={() => {
              if (!session || session.status === 'completed') {
                startNewSession();
              }
              void navigate('/logopedie/simulatie');
            }}
          >
            {copy.startIntake}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void navigate('/logopedie')}
          >
            {copy.back}
          </button>
        </>
      }
    >
      <section className="card">
        <h2>Cliënt</h2>
        <p>
          <strong>
            {scenario.client.name}, {String(scenario.client.age)} jaar
          </strong>{' '}
          <span className="badge">{copy.clientFictional}</span>
        </p>
        <p>{scenario.briefing.medicalBackground}</p>
      </section>
      <section className="card">
        <h2>Context</h2>
        <p>{scenario.briefing.consultationContext}</p>
        <p>{scenario.briefing.studentRole}</p>
        <p>Geschatte duur: {scenario.estimatedDuration}.</p>
      </section>
      <section className="card">
        <h2>Leerdoelen</h2>
        <ul className="list">
          {scenario.learningObjectives.map((item) => (
            <li key={item.id}>{item.text}</li>
          ))}
        </ul>
      </section>
      <p className="notice">{copy.fictionalNotice}</p>
    </Screen>
  );
}
