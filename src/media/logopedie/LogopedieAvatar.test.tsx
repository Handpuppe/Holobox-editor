import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LogopedieAvatar } from './LogopedieAvatar';

describe('LogopedieAvatar', () => {
  it('shows a static emotion still without motion classes or debug text', () => {
    render(<LogopedieAvatar emotion="frustrated" heightPx={1632} name="Erik de Vries" />);
    const avatar = screen.getByTestId('logopedie-avatar');
    expect(avatar).toHaveAttribute('data-avatar-variant', 'gefrustreerd');
    expect(screen.getByTestId('logopedie-avatar-image').getAttribute('src')).toContain(
      '/resources/logopedie/avatar/generated/erik/gefrustreerd.png',
    );
    expect(screen.queryByTestId('logopedie-anim-debug')).not.toBeInTheDocument();
    expect(screen.queryByTestId('logopedie-avatar-stage')).not.toBeInTheDocument();
    expect(screen.queryByTestId('fullbody-erik')).not.toBeInTheDocument();
  });

  it('uses a listening still for a cooperative speaking turn', () => {
    render(<LogopedieAvatar emotion="speaking" heightPx={1632} name="Erik de Vries" />);
    expect(screen.getByTestId('logopedie-avatar')).toHaveAttribute(
      'data-avatar-variant',
      'luistert',
    );
  });

  it('falls back to erik_basis.png and then the SVG if generated photos fail', () => {
    render(<LogopedieAvatar emotion="neutral" heightPx={1632} name="Erik de Vries" />);
    expect(screen.getByTestId('logopedie-avatar-image').getAttribute('src')).toContain(
      'onzeker.png',
    );
    fireEvent.error(screen.getByTestId('logopedie-avatar-image'));
    expect(screen.getByTestId('logopedie-avatar-image').getAttribute('src')).toContain(
      'neutraal.png',
    );
    fireEvent.error(screen.getByTestId('logopedie-avatar-image'));
    expect(screen.getByTestId('logopedie-avatar-image').getAttribute('src')).toContain(
      'erik_basis.png',
    );
    fireEvent.error(screen.getByTestId('logopedie-avatar-image'));
    expect(screen.getByTestId('logopedie-avatar')).toHaveAttribute('data-avatar-layer', 'legacy');
    expect(screen.getByTestId('fullbody-erik')).toBeInTheDocument();
  });
});
