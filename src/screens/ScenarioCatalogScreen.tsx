import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackButton } from '../components/BackButton';
import { Screen } from '../components/Screen';
import {
  builtinTile,
  fetchExtraScenarioTiles,
  fetchScenarioEnvelope,
  type ScenarioTile,
  type ScenarioTileModule,
} from '../data/scenarioTiles';
import { parseLogopedieEnvelope } from '../editor/envelope';
import { parseVerpleegkundeEnvelope } from '../editor/nursingEnvelope';
import { logopedieSaveIssues, nursingSaveIssues } from '../editor/saveChecks';
import { useAppState } from '../state/AppState';

interface ScenarioCatalogScreenProps {
  moduleId: ScenarioTileModule;
}

export function ScenarioCatalogScreen({ moduleId }: ScenarioCatalogScreenProps) {
  const navigate = useNavigate();
  const {
    selectDefaultLogopedie,
    selectLogopedieScenario,
    selectDefaultNursing,
    selectNursingScenario,
  } = useAppState();
  const [tiles, setTiles] = useState<ScenarioTile[]>([builtinTile(moduleId)]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchExtraScenarioTiles(moduleId).then((extra) => {
      if (!cancelled) {
        setTiles([builtinTile(moduleId), ...extra]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [moduleId]);

  const isLogopedie = moduleId === 'logopedie';
  const homePath = isLogopedie ? '/logopedie/home' : '/verpleegkunde/home';

  async function chooseTile(tile: ScenarioTile) {
    setLoadError(null);
    if (tile.source === 'builtin') {
      if (isLogopedie) {
        selectDefaultLogopedie();
      } else {
        selectDefaultNursing();
      }
      void navigate(homePath);
      return;
    }
    const text = await fetchScenarioEnvelope(tile.id, moduleId);
    if (!text) {
      setLoadError('Dit scenario kon niet worden geladen. Kies de standaardcasus.');
      return;
    }
    if (isLogopedie) {
      const parsed = parseLogopedieEnvelope(text);
      if (!parsed.ok || logopedieSaveIssues(parsed.scenario).length > 0) {
        setLoadError('Dit scenario is ongeldig. Kies de standaardcasus.');
        return;
      }
      selectLogopedieScenario(parsed.scenario);
    } else {
      const parsed = parseVerpleegkundeEnvelope(text);
      if (!parsed.ok || nursingSaveIssues(parsed.scenario).length > 0) {
        setLoadError('Dit scenario is ongeldig. Kies de standaardcasus.');
        return;
      }
      selectNursingScenario(parsed.scenario);
    }
    void navigate(homePath);
  }

  return (
    <Screen
      title={isLogopedie ? 'Kies een logopedie-scenario' : 'Kies een verpleegkunde-scenario'}
      testId={isLogopedie ? 'screen-logopedie-catalog' : 'screen-nursing-catalog'}
      footer={<BackButton fallback="/" />}
    >
      <p className="lead">Kies een casus. Alle patiënten en cliënten zijn fictief.</p>
      {loadError ? (
        <p className="notice notice-attention" data-testid="catalog-load-error" role="status">
          {loadError}
        </p>
      ) : null}
      <div className="scenario-tile-list">
        {tiles.map((tile) => (
          <button
            key={tile.id}
            type="button"
            className="scenario-tile"
            data-testid={
              tile.source === 'builtin'
                ? 'btn-scenario-tile-default'
                : `btn-scenario-tile-${tile.id.replaceAll('/', '_')}`
            }
            onClick={() => void chooseTile(tile)}
          >
            <span className="scenario-tile-module">{tile.module}</span>
            <span className="scenario-tile-title">{tile.title}</span>
            <span className="scenario-tile-summary">{tile.summary}</span>
          </button>
        ))}
      </div>
    </Screen>
  );
}
