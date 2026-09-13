import { copy } from '../content/nl';
import type { ClientEmotion } from '../domain/types';

interface FullBodyErikProps {
  emotion: ClientEmotion;
  reducedMotion: boolean;
  heightPx: number;
}

function mouth(emotion: ClientEmotion): string {
  if (emotion === 'frustrated' || emotion === 'confused') {
    return 'M174 118 Q180 112 186 118';
  }
  if (emotion === 'reassured' || emotion === 'speaking') {
    return 'M172 116 Q180 124 188 116';
  }
  if (emotion === 'fatigued') {
    return 'M174 118 Q180 116 186 118';
  }
  return 'M173 117 Q180 120 187 117';
}

export function FullBodyErik({ emotion, reducedMotion, heightPx }: FullBodyErikProps) {
  return (
    <svg
      className={reducedMotion ? 'fullbody-svg' : 'fullbody-svg fullbody-breath'}
      viewBox="0 0 360 960"
      width={Math.round(heightPx * 0.375)}
      height={heightPx}
      role="img"
      aria-labelledby="erik-full-title erik-full-desc"
      data-testid="fullbody-erik"
    >
      <title id="erik-full-title">{`Erik de Vries (${copy.clientFictional})`}</title>
      <desc id="erik-full-desc">
        Levensgrote stilstaande illustratie van Erik de Vries, een fictieve volwassen man, van hoofd
        tot voeten. Uitdrukking: {copy.emotionLabels[emotion]}.
      </desc>
      <ellipse cx="180" cy="942" rx="108" ry="14" fill="#d7e0e3" />
      <ellipse cx="152" cy="928" rx="26" ry="11" fill="#2c3338" />
      <ellipse cx="208" cy="928" rx="26" ry="11" fill="#2c3338" />
      <rect x="130" y="448" width="40" height="470" rx="18" fill="#3b4a54" />
      <rect x="190" y="448" width="40" height="470" rx="18" fill="#3b4a54" />
      <path d="M128 430 C150 448 210 448 232 430 L222 470 H138 Z" fill="#3b4a54" />
      <path
        d="M108 250 C130 210 230 210 252 250 L246 450 C210 470 150 470 114 450 Z"
        fill="#0b6e7a"
      />
      <path d="M168 250 L180 320 L192 250 Z" fill="#d7e4e7" />
      <ellipse cx="96" cy="310" rx="16" ry="70" fill="#e6c2a6" />
      <ellipse cx="264" cy="310" rx="16" ry="70" fill="#e6c2a6" />
      <circle cx="180" cy="148" r="62" fill="#e6c2a6" />
      <ellipse cx="118" cy="154" rx="12" ry="18" fill="#e6c2a6" />
      <ellipse cx="242" cy="154" rx="12" ry="18" fill="#e6c2a6" />
      <path d="M132 118 C156 84 204 82 230 118 C206 108 154 108 132 118 Z" fill="#7a6a5c" />
      <ellipse cx="158" cy="146" rx="10" ry="7" fill="#ffffff" />
      <ellipse cx="202" cy="146" rx="10" ry="7" fill="#ffffff" />
      <circle cx="158" cy="146" r="3.2" fill="#2c3a43" />
      <circle cx="202" cy="146" r="3.2" fill="#2c3a43" />
      <path d="M146 132 Q158 128 168 132" fill="none" stroke="#4f433a" strokeWidth="3" />
      <path d="M192 132 Q202 128 214 132" fill="none" stroke="#4f433a" strokeWidth="3" />
      <path d={mouth(emotion)} fill="none" stroke="#9a5b4c" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
