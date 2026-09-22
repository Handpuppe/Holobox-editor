import { useEffect, useRef, useState } from 'react';
import type { ClientEmotion } from '../domain/types';
import { LogopedieAvatar } from './logopedie/LogopedieAvatar';
import { resolveSlot } from './matching';
import { visiblePatientHeightPx } from './scale';
import { slotById } from './scenarioMedia';
import type {
  MediaSlotConfig,
  PatientDisplayConfig,
  PatientMediaState,
  TrainingModule,
} from './types';

interface PatientStageProps {
  moduleId: TrainingModule;
  name: string;
  fictionalLabel: string;
  mediaSlotId?: string;
  mediaOverride?: string;
  state: PatientMediaState;
  emotion?: ClientEmotion;
  caption: string;
  context?: string;
  audioUnlocked: boolean;
  muted: boolean;
  volume: number;
  teacherMode?: boolean;
  display: PatientDisplayConfig;
  replayToken?: number;
  onAudioBlocked?: () => void;
  slots?: MediaSlotConfig[];
}

export function PatientStage({
  moduleId,
  name,
  fictionalLabel,
  mediaSlotId,
  mediaOverride,
  state,
  emotion = 'neutral',
  caption,
  audioUnlocked,
  muted,
  volume,
  display,
  replayToken = 0,
  onAudioBlocked,
  slots,
}: PatientStageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const slot = mediaSlotId ? slotById(mediaSlotId, slots) : undefined;
  const resolved = slot ? resolveSlot(slot, mediaOverride) : { media: null, alternatives: [] };
  const media = resolved.media && resolved.media.module === moduleId ? resolved.media : null;
  const heightPx = visiblePatientHeightPx(display);
  const mediaError = Boolean(media?.publicUrl && failedUrl === media.publicUrl);
  const showVideo = Boolean(media && media.fileType === 'video' && !mediaError);
  const isLogopedie = moduleId === 'logopedie';

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !showVideo) {
      return;
    }
    video.defaultMuted = muted;
    video.muted = muted;
    video.volume = Math.min(1, Math.max(0, volume));
    for (const track of video.textTracks) {
      track.mode = 'hidden';
    }
    if (audioUnlocked) {
      const playAttempt = video.play();
      if (playAttempt) {
        void playAttempt.catch(() => {
          onAudioBlocked?.();
        });
      }
    } else {
      video.pause();
    }
  }, [audioUnlocked, media?.publicUrl, muted, onAudioBlocked, replayToken, showVideo, volume]);

  return (
    <section
      className="patient-area"
      data-testid="patient-area"
      aria-label={`${name}, ${fictionalLabel}`}
    >
      <p className="visually-hidden" data-testid="live-patient-caption">
        {caption}
      </p>
      <div
        className={`patient-figure${showVideo ? ' has-video' : ''}${isLogopedie ? ' has-logopedie-photo' : ''}${state === 'kritiek' ? ' is-critical' : ''}`}
        style={
          isLogopedie ? { width: '100%', height: '100%' } : { height: `${String(heightPx)}px` }
        }
        data-testid="virtual-client"
        data-emotion={emotion}
        data-state={mediaError ? 'mediafout' : state}
      >
        {showVideo ? (
          <video
            key={`${media?.relativePath ?? 'none'}-${String(replayToken)}`}
            ref={videoRef}
            className="patient-video"
            data-testid="patient-video"
            src={media?.publicUrl}
            playsInline
            preload="metadata"
            controls={false}
            loop={false}
            onError={() => setFailedUrl(media?.publicUrl ?? 'mediafout')}
            aria-label={slot?.studentLabel ?? 'Observatie van de patiënt'}
            style={{ backgroundColor: '#ffffff' }}
          >
            <track
              kind="captions"
              srcLang="nl"
              label="Nederlands"
              src={`data:text/vtt,WEBVTT%0A%0A00:00.000%20--%3E%2000:59.000%0A${encodeURIComponent(slot?.captions ?? 'Observatievideo, fictieve onderwijssituatie.')}`}
            />
          </video>
        ) : isLogopedie ? (
          <LogopedieAvatar emotion={emotion} heightPx={heightPx} name={name} />
        ) : (
          <div className="nursing-video-fallback" data-testid="nursing-video-fallback">
            Video ontbreekt
          </div>
        )}
        {showVideo ? (
          <svg className="visually-hidden" aria-hidden="true" width="0" height="0">
            <filter id="video-white-bg" colorInterpolationFilters="sRGB">
              <feComponentTransfer>
                <feFuncR type="linear" slope="1.22" intercept="-0.14" />
                <feFuncG type="linear" slope="1.22" intercept="-0.14" />
                <feFuncB type="linear" slope="1.22" intercept="-0.14" />
              </feComponentTransfer>
            </filter>
          </svg>
        ) : null}
      </div>
    </section>
  );
}
