import { useState } from 'react';
import { copy } from '../../content/nl';
import type { ClientEmotion } from '../../domain/types';
import { FullBodyErik } from '../FullBodyErik';
import { avatarSourceChain, resourceSrc } from './resolveAvatar';

interface LogopedieAvatarProps {
  emotion: ClientEmotion;
  heightPx: number;
  name: string;
  srcOverride?: string | null;
}

export function LogopedieAvatar({ emotion, heightPx, name, srcOverride }: LogopedieAvatarProps) {
  const [failStep, setFailStep] = useState(0);
  const [trackedEmotion, setTrackedEmotion] = useState(emotion);
  const label = `${name} (${copy.clientFictional})`;
  const expression = copy.emotionLabels[emotion];

  if (trackedEmotion !== emotion) {
    setTrackedEmotion(emotion);
    setFailStep(0);
  }

  const chain = avatarSourceChain(emotion);
  const current = chain[Math.min(failStep, chain.length - 1)] ?? null;

  if (!current || current.layer === 'legacy' || !current.relativePath) {
    return (
      <div
        className="logopedie-avatar"
        data-testid="logopedie-avatar"
        data-avatar-layer="legacy"
        data-avatar-emotion={emotion}
        data-avatar-variant="legacy"
      >
        <FullBodyErik emotion={emotion} reducedMotion heightPx={heightPx} />
      </div>
    );
  }

  return (
    <div
      className="logopedie-avatar"
      data-testid="logopedie-avatar"
      data-avatar-layer={current.layer}
      data-avatar-emotion={emotion}
      data-avatar-variant={current.variant}
    >
      <img
        className="logopedie-avatar-img"
        data-testid="logopedie-avatar-image"
        src={srcOverride ?? resourceSrc(current.relativePath)}
        alt={`${label}. Uitdrukking: ${expression}.`}
        onError={() => {
          if (srcOverride) {
            return;
          }
          setFailStep((step) => step + 1);
        }}
      />
      <div className="logopedie-floor-shadow" aria-hidden="true" />
    </div>
  );
}
