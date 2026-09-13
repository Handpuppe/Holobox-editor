import { Screen } from '../components/Screen';
import { copy } from '../content/nl';

export function LoadingScreen() {
  return (
    <Screen title={copy.loading} testId="screen-loading">
      <p className="lead">
        Een moment geduld. De training start op een wit scherm van 1080 × 1920 pixels.
      </p>
      <p className="notice">{copy.fictionalNotice}</p>
    </Screen>
  );
}
