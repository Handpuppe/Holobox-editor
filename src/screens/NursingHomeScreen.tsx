import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog } from '../components/Dialog';
import { Screen } from '../components/Screen';
import { copy } from '../content/nl';
import { APP_VERSION } from '../domain/types';
import { useAppState } from '../state/AppState';

export function NursingHomeScreen() {
  const navigate = useNavigate();
  const { nursingSession, startNursing, discardNursing } = useAppState();
  const unfinished = nursingSession && nursingSession.status !== 'completed';
  const [showResume, setShowResume] = useState(Boolean(unfinished));

  return (
    <Screen
      title="Verpleegkunde – Virtuele Patiënt"
      testId="screen-nursing-home"
      footer={
        <>
          <button
            type="button"
            className="btn"
            data-testid="btn-start-nursing"
            onClick={() => {
              if (unfinished) {
                setShowResume(true);
                return;
              }
              startNursing();
              void navigate('/verpleegkunde/briefing');
            }}
          >
            Start simulatie
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => void navigate('/')}>
            {copy.home}
          </button>
        </>
      }
    >
      <p className="lead">
        Oefen ABCDE en SBAR met meneer de Vries, een fictieve patiënt met acute benauwdheid.
      </p>
      <p className="notice">
        {copy.fictionalNotice} Dit is geen diagnostisch instrument en geen vervanging van zorg.
      </p>
      <p className="version-line">
        {copy.versionLabel} {APP_VERSION}
      </p>
      {showResume && unfinished ? (
        <Dialog
          title={copy.resumeTitle}
          testId="dialog-resume-nursing"
          onClose={() => setShowResume(false)}
        >
          <p>Er staat een onvoltooide verpleegkunde-sessie open.</p>
          <div className="stack" style={{ marginTop: 24 }}>
            <button
              type="button"
              className="btn"
              data-testid="btn-resume-nursing"
              onClick={() => {
                setShowResume(false);
                void navigate('/verpleegkunde/simulatie');
              }}
            >
              {copy.resumeSession}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                discardNursing();
                startNursing();
                setShowResume(false);
                void navigate('/verpleegkunde/briefing');
              }}
            >
              {copy.discardSession}
            </button>
          </div>
        </Dialog>
      ) : null}
    </Screen>
  );
}
