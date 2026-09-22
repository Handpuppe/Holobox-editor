import { BackButton } from '../components/BackButton';
import { Screen } from '../components/Screen';
import { copy } from '../content/nl';
import { APP_VERSION, RUBRIC_VERSION, SCENARIO_VERSION } from '../domain/types';

export function AboutScreen() {
  return (
    <Screen title={copy.aboutTraining} testId="screen-about" footer={<BackButton />}>
      <p className="lead">{copy.appName}</p>
      <p className="notice">
        {copy.fictionalNotice} {copy.educationalNotice}
      </p>
      <section className="card">
        <h2>{copy.aboutDisclaimerTitle}</h2>
        <p>{copy.aboutDisclaimer}</p>
      </section>
      <section className="card">
        <h2>{copy.aboutPrivacyTitle}</h2>
        <p>{copy.aboutPrivacy}</p>
        <p>{copy.aboutClearData}</p>
      </section>
      <p className="version-line" data-testid="about-version">
        {copy.versionLabel} {APP_VERSION} · scenario {SCENARIO_VERSION} · rubriek {RUBRIC_VERSION}
      </p>
    </Screen>
  );
}
