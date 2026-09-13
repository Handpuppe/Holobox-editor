import { useNavigate } from 'react-router-dom';
import { SideAppMenu } from '../components/SideAppMenu';
import { copy } from '../content/nl';
import { PatientStage } from '../media/PatientStage';
import { defaultDisplayConfig } from '../media/scale';
import { useAppState } from '../state/AppState';

export function TeacherPreviewScreen() {
  const navigate = useNavigate();
  const { teacher } = useAppState();
  const display = {
    ...defaultDisplayConfig(teacher.patientHeightByModule.verpleegkunde, teacher.displayHeightCm),
    floorBaseline: teacher.floorBaseline,
    scaleCorrection: teacher.scaleCorrection,
  };

  return (
    <div className="sim-layout" data-testid="screen-teacher-preview">
      <PatientStage
        moduleId="verpleegkunde"
        name="Meneer de Vries"
        fictionalLabel={copy.clientFictional}
        mediaSlotId="nursing-airway"
        mediaOverride={teacher.mediaOverrides['nursing-airway']}
        state="idle"
        caption="Kalibratievoorbeeld op ware grootte. Fictieve patiënt."
        audioUnlocked={false}
        muted
        volume={0}
        teacherMode
        display={display}
      />
      <aside className="question-panel" lang="nl">
        <SideAppMenu />
        <p className="patient-identity">
          Meneer de Vries <span className="badge">{copy.clientFictional}</span>
        </p>
        <p className="panel-question">Kalibratie</p>
        <p className="muted">
          Patiënt {String(teacher.patientHeightByModule.verpleegkunde)} cm op een scherm van{' '}
          {String(teacher.displayHeightCm)} cm.
        </p>
        <button type="button" className="btn" onClick={() => void navigate('/docent')}>
          Terug naar instellingen
        </button>
      </aside>
    </div>
  );
}
