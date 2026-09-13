import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Screen } from '../components/Screen';
import { copy } from '../content/nl';
import { aphasiaIntakeScenario } from '../data/aphasiaIntakeScenario';
import { EMPTY_CONCLUSION, sanitizeConclusion, validateConclusion } from '../domain/conclusion';
import { CONCLUSION_TEXT_MAX_LENGTH, type ClinicalConclusion } from '../domain/types';
import { useAppState } from '../state/AppState';

export function ConclusionScreen() {
  const navigate = useNavigate();
  const { session, submitConclusion } = useAppState();
  const [form, setForm] = useState<ClinicalConclusion>(session?.conclusion ?? EMPTY_CONCLUSION);
  const [errors, setErrors] = useState<ReturnType<typeof validateConclusion>['errors']>({});
  const [submitted, setSubmitted] = useState(false);

  const fields = aphasiaIntakeScenario.conclusionFields;
  const textByField = useMemo(
    () => ({
      dailyLifeEffect: 'dailyLifeEffect' as const,
      firstObjective: 'firstObjective' as const,
    }),
    [],
  );

  if (!session) {
    return <Navigate to="/logopedie" replace />;
  }
  if (session.status === 'completed' && session.conclusion) {
    return <Navigate to="/logopedie/resultaat" replace />;
  }

  return (
    <Screen
      title="Voorlopige klinische conclusie"
      testId="screen-conclusion"
      footer={
        <button
          type="submit"
          form="conclusion-form"
          className="btn"
          data-testid="btn-submit-conclusion"
        >
          {copy.submitConclusion}
        </button>
      }
    >
      <p className="lead">
        Baseer je conclusie op wat je in het gesprek hoorde en zag. Vrije tekst telt niet mee in de
        score.
      </p>
      <form
        id="conclusion-form"
        className="stack-lg"
        onSubmit={(event) => {
          event.preventDefault();
          const clean = sanitizeConclusion(form);
          const result = validateConclusion(clean, aphasiaIntakeScenario);
          setSubmitted(true);
          setErrors(result.errors);
          if (!result.valid) {
            const firstError = document.querySelector<HTMLElement>('[data-invalid="true"]');
            firstError?.focus();
            return;
          }
          submitConclusion(clean);
          void navigate('/logopedie/resultaat');
        }}
      >
        {fields.map((field) => {
          const fieldError = errors[field.id];
          const textError =
            field.id === 'dailyLifeEffect'
              ? errors.dailyLifeText
              : field.id === 'firstObjective'
                ? errors.objectiveText
                : undefined;
          return (
            <fieldset
              key={field.id}
              className="card"
              data-invalid={fieldError ? 'true' : undefined}
              tabIndex={fieldError ? -1 : undefined}
            >
              <legend className="section-title">{field.label}</legend>
              <p className="muted">{field.help}</p>
              <div className="stack" style={{ marginTop: 16 }}>
                {field.choices.map((choice) => (
                  <label className="choice" key={choice.id}>
                    <input
                      type="radio"
                      name={field.id}
                      value={choice.id}
                      data-testid={`conclusion-${choice.id}`}
                      checked={form[field.id] === choice.id}
                      onChange={() => setForm((current) => ({ ...current, [field.id]: choice.id }))}
                    />
                    <span>{choice.text}</span>
                  </label>
                ))}
              </div>
              {fieldError && submitted ? (
                <p className="field-error" role="alert">
                  {fieldError}
                </p>
              ) : null}
              {field.textRequired ? (
                <div className="field" style={{ marginTop: 16 }}>
                  <label htmlFor={`text-${field.id}`}>{field.textLabel}</label>
                  <textarea
                    id={`text-${field.id}`}
                    data-testid={`conclusion-text-${field.id}`}
                    maxLength={CONCLUSION_TEXT_MAX_LENGTH}
                    value={form.freeText[textByField[field.id as keyof typeof textByField]]}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        freeText: {
                          ...current.freeText,
                          [field.id]: event.target.value.slice(0, CONCLUSION_TEXT_MAX_LENGTH),
                        },
                      }))
                    }
                  />
                  {textError && submitted ? (
                    <p className="field-error" role="alert">
                      {textError}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </fieldset>
          );
        })}
      </form>
    </Screen>
  );
}
