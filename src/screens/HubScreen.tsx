import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '../components/Screen';
import { copy } from '../content/nl';
import {
  fetchGesprekMenuTiles,
  fetchScenarioEnvelope,
  type ScenarioTile,
} from '../data/scenarioTiles';
import { APP_VERSION } from '../domain/types';
import { parseVerpleegkundeEnvelope } from '../editor/nursingEnvelope';
import { nursingSaveIssues } from '../editor/saveChecks';
import { withBaseUrl } from '../media/baseUrl';
import { useAppState } from '../state/AppState';

export function HubScreen() {
  const navigate = useNavigate();
  const { storageAvailable, storageNotice, selectNursingScenario } = useAppState();
  const [tiles, setTiles] = useState<ScenarioTile[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const next = await fetchGesprekMenuTiles();
      if (!cancelled) {
        setTiles(next);
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

  async function openCase(tile: ScenarioTile) {
    setLoadError(null);
    const text = await fetchScenarioEnvelope(tile.id, 'verpleegkunde');
    if (!text) {
      setLoadError('Dit scenario kon niet worden geladen.');
      return;
    }
    const parsed = parseVerpleegkundeEnvelope(text);
    if (!parsed.ok || nursingSaveIssues(parsed.scenario).length > 0) {
      setLoadError('Dit scenario is ongeldig.');
      return;
    }
    selectNursingScenario(parsed.scenario);
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
        {tiles.length === 0 ? (
          <p data-testid="gesprek-menu-empty">Er is nog geen gesprekscasus.</p>
        ) : (
          <div className="scenario-tile-list">
            {tiles.map((tile) => (
              <button
                key={tile.id}
                type="button"
                className="scenario-tile"
                data-testid={`btn-scenario-tile-${tile.id.replaceAll('/', '_')}`}
                onClick={() => void openCase(tile)}
              >
                <span className="scenario-tile-module">Gesprekstechnieken</span>
                <span className="scenario-tile-title">{tile.title}</span>
                <span className="scenario-tile-summary">{tile.summary}</span>
              </button>
            ))}
          </div>
        )}
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
