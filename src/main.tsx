import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AppStateProvider } from './state/AppState';
import './styles/global.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element ontbreekt.');
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </BrowserRouter>
  </StrictMode>,
);
