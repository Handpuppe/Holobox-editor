import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom';
import type { ReactElement } from 'react';
import { App } from '../App';
import { AppStateProvider } from '../state/AppState';

export function renderApp(
  initialEntries: MemoryRouterProps['initialEntries'] = ['/'],
  options?: RenderOptions,
) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </MemoryRouter>,
    options,
  );
}

export function renderWithProviders(ui: ReactElement, initialEntries: string[] = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AppStateProvider>{ui}</AppStateProvider>
    </MemoryRouter>,
  );
}
