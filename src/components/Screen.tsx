import { useEffect, useRef, type ReactNode } from 'react';

interface ScreenProps {
  title: string;
  testId: string;
  children: ReactNode;
  footer?: ReactNode;
  eyebrow?: string;
}

export function Screen({ title, testId, children, footer, eyebrow }: ScreenProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [title]);

  return (
    <div className="screen" data-testid={testId}>
      <header className="screen-header">
        {eyebrow ? <p className="muted">{eyebrow}</p> : null}
        <h1 id="screen-title" tabIndex={-1} ref={headingRef}>
          {title}
        </h1>
      </header>
      <main
        id="inhoud"
        className="screen-main"
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- overflow keyboard access
        tabIndex={0}
      >
        {children}
      </main>
      {footer ? <footer className="screen-actions">{footer}</footer> : null}
    </div>
  );
}
