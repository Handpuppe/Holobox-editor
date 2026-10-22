import { useEffect, useState } from 'react';
import homeBanner from '../../Banner -Scenario-gedreven holografisch onderwijs.png';
import { useNavigate } from 'react-router-dom';
import { Screen } from '../components/Screen';
import { copy } from '../content/nl';
import {
  fetchHoloboxPackages,
  openHoloboxCase,
  type HoloboxPackageListing,
} from '../data/openHoloboxCase';
import { resolveNursingScenario } from '../data/loadNursingScenario';
import { APP_VERSION } from '../domain/types';
import { canSaveToThisCopy } from '../editor/editorHost';
import { withBaseUrl } from '../media/baseUrl';
import { useAppState } from '../state/AppState';

interface PublicQuestion {
  name: string;
  question: string;
}

export function HubScreen() {
  const navigate = useNavigate();
  const { storageAvailable, storageNotice, selectNursingScenario } = useAppState();
  const [packages, setPackages] = useState<HoloboxPackageListing[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [opening, setOpening] = useState(false);
  const [publicTitle, setPublicTitle] = useState('');
  const [publicQuestions, setPublicQuestions] = useState<PublicQuestion[] | null>(null);
  const [publicChecked, setPublicChecked] = useState(() => canSaveToThisCopy());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const next = await fetchHoloboxPackages();
      if (!cancelled) {
        setPackages(next);
      }
    }
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (canSaveToThisCopy()) {
      return;
    }
    let cancelled = false;
    void resolveNursingScenario().then((loaded) => {
      if (cancelled) {
        return;
      }
      if (loaded.source === 'json') {
        const questions = loaded.scenario.steps.flatMap((step) => {
          const name = step.stepName?.trim() ?? '';
          if (name === '') {
            return [];
          }
          return [{ name, question: step.question }];
        });
        if (questions.length > 0) {
          setPublicTitle(loaded.scenario.meta.title);
          setPublicQuestions(questions);
        }
      }
      setPublicChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function openPackage(file: string) {
    if (opening) {
      return;
    }
    setOpening(true);
    setLoadError(null);
    const opened = await openHoloboxCase(file);
    setOpening(false);
    if (!opened.ok) {
      setLoadError(opened.error);
      return;
    }
    selectNursingScenario(opened.scenario);
    void navigate('/verpleegkunde/home');
  }

  async function quitApp() {
    if (closing) {
      return;
    }
    setClosing(true);
    try {
      await fetch(withBaseUrl('/editor-api/quit?immediate=1'), { method: 'POST' });
    } catch {
      // Het stop-script sluit de servers ook als dit verzoek de pagina al verlaat.
    }
    window.close();
  }

  return (
    <Screen
      title="Phosaner — Scenario-gedreven holografisch onderwijs."
      bannerSrc={homeBanner}
      testId="screen-home"
      footer={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="btn-previous-results"
            onClick={() => void navigate('/geschiedenis')}
          >
            {copy.previousResults}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="btn-teacher"
            onClick={() => void navigate('/docent')}
          >
            Docentconfiguratie
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="btn-about"
            onClick={() => void navigate('/over')}
          >
            Over deze applicatie
          </button>
          <button
            type="button"
            className="btn btn-danger"
            data-testid="btn-quit-app"
            onClick={() => void quitApp()}
          >
            Afsluiten
          </button>
        </>
      }
    >
      <p className="lead">
        Kies een gesprekscasus. Alle patiënten en cliënten in deze app zijn fictief.
      </p>
      <section className="card">
        <h2>Gesprekstechnieken</h2>
        {loadError ? (
          <p className="notice notice-attention" data-testid="catalog-load-error" role="status">
            {loadError}
          </p>
        ) : null}
        {packages.length === 0 && publicQuestions && publicQuestions.length > 0 ? (
          <div data-testid="public-gesprekscasus">
            <p className="scenario-tile-title">{publicTitle}</p>
            <ol data-testid="public-question-list">
              {publicQuestions.map((step) => (
                <li key={step.name}>
                  <strong>{step.name}</strong> {step.question}
                </li>
              ))}
            </ol>
          </div>
        ) : packages.length === 0 && publicChecked ? (
          <p data-testid="gesprek-menu-empty">Er is nog geen gesprekscasus.</p>
        ) : packages.length > 0 ? (
          <div className="scenario-tile-list">
            {packages.map((item) => (
              <button
                key={item.zip}
                type="button"
                className="scenario-tile"
                data-testid={`btn-scenario-tile-${item.zip.replaceAll('/', '_')}`}
                onClick={() => void openPackage(item.file)}
              >
                <span className="scenario-tile-module">Gesprekstechnieken</span>
                <span className="scenario-tile-title">{item.title}</span>
              </button>
            ))}
          </div>
        ) : null}
      </section>
      <p className="notice" data-testid="fictional-notice">
        {copy.fictionalNotice} {copy.educationalNotice}
      </p>
      {!storageAvailable ? (
        <p className="notice notice-attention" data-testid="storage-unavailable">
          {copy.storageUnavailable}
        </p>
      ) : null}
      {storageNotice && storageNotice !== 'unavailable' ? (
        <p className="notice notice-attention" data-testid="storage-notice">
          {copy.storageCorrupted}
        </p>
      ) : null}
      <div className="version-block" data-testid="app-version-block">
        <p className="version-line" data-testid="app-version">
          {copy.versionLabel} {APP_VERSION}
        </p>
        <p className="version-line" data-testid="app-credit">
          Made by Rutger van Horssen
        </p>
      </div>
    </Screen>
  );
}
