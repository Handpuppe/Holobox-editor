import { Navigate, Route, Routes } from 'react-router-dom';
import { HoloboxShell } from './components/HoloboxShell';
import { copy } from './content/nl';
import { AboutScreen } from './screens/AboutScreen';
import { BriefingScreen } from './screens/BriefingScreen';
import { ConclusionScreen } from './screens/ConclusionScreen';
import { ErrorScreen } from './screens/ErrorScreen';
import { HomeScreen } from './screens/HomeScreen';
import { HubScreen } from './screens/HubScreen';
import { LoadingScreen } from './screens/LoadingScreen';
import { NursingBriefingScreen } from './screens/NursingBriefingScreen';
import { NursingHomeScreen } from './screens/NursingHomeScreen';
import { NursingResultsScreen } from './screens/NursingResultsScreen';
import { NursingSimulationScreen } from './screens/NursingSimulationScreen';
import { PreviousResultsScreen } from './screens/PreviousResultsScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { SimulationScreen } from './screens/SimulationScreen';
import { TeacherPreviewScreen } from './screens/TeacherPreviewScreen';
import { TeacherScreen } from './screens/TeacherScreen';
import { useAppState } from './state/AppState';

export function App() {
  const { scenarioValid, scenarioIssues } = useAppState();

  return (
    <HoloboxShell>
      <a className="skip-link" href="#inhoud">
        {copy.skipLink}
      </a>
      {!scenarioValid ? (
        <ErrorScreen message="De scenario-configuratie is ongeldig." issues={scenarioIssues} />
      ) : (
        <Routes>
          <Route path="/" element={<HubScreen />} />
          <Route path="/logopedie" element={<HomeScreen />} />
          <Route path="/logopedie/briefing" element={<BriefingScreen />} />
          <Route path="/logopedie/simulatie" element={<SimulationScreen />} />
          <Route path="/logopedie/conclusie" element={<ConclusionScreen />} />
          <Route path="/logopedie/resultaat" element={<ResultsScreen />} />
          <Route path="/logopedie/resultaat/:resultId" element={<ResultsScreen />} />
          <Route path="/verpleegkunde" element={<NursingHomeScreen />} />
          <Route path="/verpleegkunde/briefing" element={<NursingBriefingScreen />} />
          <Route path="/verpleegkunde/simulatie" element={<NursingSimulationScreen />} />
          <Route path="/verpleegkunde/resultaat" element={<NursingResultsScreen />} />
          <Route path="/geschiedenis" element={<PreviousResultsScreen />} />
          <Route path="/resultaat/:resultId" element={<ResultsScreen />} />
          <Route path="/docent" element={<TeacherScreen />} />
          <Route path="/docent/voorbeeld" element={<TeacherPreviewScreen />} />
          <Route path="/over" element={<AboutScreen />} />
          <Route path="/laden" element={<LoadingScreen />} />
          <Route path="/storing" element={<ErrorScreen />} />
          <Route path="/briefing" element={<Navigate to="/logopedie/briefing" replace />} />
          <Route path="/simulatie" element={<Navigate to="/logopedie/simulatie" replace />} />
          <Route path="/conclusie" element={<Navigate to="/logopedie/conclusie" replace />} />
          <Route path="/resultaat" element={<Navigate to="/logopedie/resultaat" replace />} />
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="*" element={<ErrorScreen />} />
        </Routes>
      )}
    </HoloboxShell>
  );
}
