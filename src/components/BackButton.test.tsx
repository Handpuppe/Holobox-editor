import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { BackButton } from './BackButton';

describe('BackButton', () => {
  it('goes one page back in history', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/a', '/b']}>
        <Routes>
          <Route path="/a" element={<p data-testid="page-a">A</p>} />
          <Route path="/b" element={<BackButton fallback="/a" />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('btn-back')).toHaveTextContent('Terug');
    await user.click(screen.getByTestId('btn-back'));
    expect(screen.getByTestId('page-a')).toBeInTheDocument();
  });
});
