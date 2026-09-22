import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackButton } from '../components/BackButton';
import { Screen } from '../components/Screen';
import { listModuleMedia } from '../media/matching';
import { mediaSlots } from '../media/scenarioMedia';
import { defaultTeacherSettings } from '../media/teacherDefaults';
import type { TeacherSettings, TrainingModule } from '../media/types';
import { useAppState } from '../state/AppState';

export function TeacherScreen() {
  const navigate = useNavigate();
  const { teacher, saveTeacher } = useAppState();
  const [draft, setDraft] = useState<TeacherSettings>(teacher);
  const [moduleId, setModuleId] = useState<TrainingModule>('verpleegkunde');
  return (
    <Screen
      title="Docentconfiguratie"
      testId="screen-teacher"
      footer={
        <>
          <button
            type="button"
            className="btn"
            data-testid="btn-save-teacher"
            onClick={() => saveTeacher(draft)}
          >
            Instellingen opslaan
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              const next = defaultTeacherSettings();
              setDraft(next);
              saveTeacher(next);
            }}
          >
            Standaard herstellen
          </button>
          <BackButton />
        </>
      }
    >
      <p className="lead">
        Kalibreer de ware-grootteweergave. Instellingen blijven lokaal op dit apparaat.
      </p>
      <section className="card">
        <h2>Scherm en schaal</h2>
        <div className="field">
          <label htmlFor="display-height">Fysieke schermhoogte (cm)</label>
          <input
            id="display-height"
            type="number"
            min={160}
            max={240}
            value={draft.displayHeightCm}
            onChange={(event) =>
              setDraft({ ...draft, displayHeightCm: Number(event.target.value) })
            }
          />
        </div>
        <div className="field">
          <label htmlFor="patient-height">Patiëntlengte {moduleId} (cm)</label>
          <input
            id="patient-height"
            type="number"
            min={140}
            max={200}
            value={draft.patientHeightByModule[moduleId]}
            onChange={(event) =>
              setDraft({
                ...draft,
                patientHeightByModule: {
                  ...draft.patientHeightByModule,
                  [moduleId]: Number(event.target.value),
                },
              })
            }
          />
        </div>
        <div className="field">
          <label htmlFor="scale">Schaalcorrectie</label>
          <input
            id="scale"
            type="number"
            min={0.85}
            max={1.15}
            step={0.01}
            value={draft.scaleCorrection}
            onChange={(event) =>
              setDraft({ ...draft, scaleCorrection: Number(event.target.value) })
            }
          />
        </div>
        <div className="field">
          <label htmlFor="floor">Vloerbasis (0.02–0.18)</label>
          <input
            id="floor"
            type="number"
            min={0.02}
            max={0.18}
            step={0.01}
            value={draft.floorBaseline}
            onChange={(event) => setDraft({ ...draft, floorBaseline: Number(event.target.value) })}
          />
        </div>
        <label htmlFor="module-select">Voorbeeldmodule</label>
        <select
          id="module-select"
          value={moduleId}
          onChange={(event) => setModuleId(event.target.value as TrainingModule)}
        >
          <option value="logopedie">Logopedie</option>
          <option value="verpleegkunde">Verpleegkunde</option>
        </select>
      </section>
      <button
        type="button"
        className="btn btn-secondary"
        data-testid="btn-teacher-preview"
        onClick={() => {
          saveTeacher(draft);
          void navigate('/docent/voorbeeld');
        }}
      >
        Bekijk voorbeeld op ware grootte
      </button>
      <section className="card">
        <h2>Mediakoppeling</h2>
        {mediaSlots
          .filter((slot) => slot.module === 'verpleegkunde')
          .map((slot) => (
            <div className="field" key={slot.slotId}>
              <label htmlFor={`slot-${slot.slotId}`}>{slot.studentLabel}</label>
              <select
                id={`slot-${slot.slotId}`}
                value={draft.mediaOverrides[slot.slotId] ?? slot.primaryMedia ?? ''}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    mediaOverrides: { ...draft.mediaOverrides, [slot.slotId]: event.target.value },
                  })
                }
              >
                {listModuleMedia('verpleegkunde').map((item) => (
                  <option key={item.relativePath} value={item.relativePath}>
                    {item.relativePath.replace('verpleegkunde/', '')}
                  </option>
                ))}
              </select>
            </div>
          ))}
      </section>
    </Screen>
  );
}
