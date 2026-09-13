import { useEffect, useState, type ReactNode } from 'react';

interface HoloboxShellProps {
  children: ReactNode;
}

const STAGE_WIDTH = 1080;
const STAGE_HEIGHT = 1920;

export function HoloboxShell({ children }: HoloboxShellProps) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function update() {
      const next = Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT);
      setScale(Number.isFinite(next) && next > 0 ? next : 1);
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return (
    <div className="holobox-viewport" data-testid="holobox-viewport">
      <div
        className="holobox-stage"
        data-testid="holobox-stage"
        data-app-root="true"
        style={{ transform: `scale(${String(scale)})` }}
      >
        {children}
      </div>
    </div>
  );
}
