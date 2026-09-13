import { copy } from '../content/nl';
import type { ClientEmotion } from '../domain/types';

interface VirtualClientProps {
  emotion: ClientEmotion;
  name: string;
  reducedMotion: boolean;
}

function features(emotion: ClientEmotion): {
  leftBrow: string;
  rightBrow: string;
  mouth: string;
  eyeOpen: number;
  tilt: number;
  slump: number;
} {
  switch (emotion) {
    case 'listening':
      return {
        leftBrow: 'M148 152 Q174 146 198 152',
        rightBrow: 'M222 152 Q246 146 272 152',
        mouth: 'M186 236 Q210 244 234 236',
        eyeOpen: 1,
        tilt: 2,
        slump: 0,
      };
    case 'speaking':
      return {
        leftBrow: 'M148 154 Q174 148 198 154',
        rightBrow: 'M222 154 Q246 148 272 154',
        mouth: 'M188 234 Q210 252 232 234',
        eyeOpen: 1,
        tilt: 0,
        slump: 0,
      };
    case 'thinking':
      return {
        leftBrow: 'M148 148 Q174 140 198 156',
        rightBrow: 'M222 150 Q246 144 272 150',
        mouth: 'M190 240 Q210 238 230 240',
        eyeOpen: 0.85,
        tilt: -3,
        slump: 0,
      };
    case 'confused':
      return {
        leftBrow: 'M148 144 Q174 158 198 148',
        rightBrow: 'M222 152 Q250 140 274 156',
        mouth: 'M188 240 Q210 234 236 242',
        eyeOpen: 1,
        tilt: 4,
        slump: 0,
      };
    case 'frustrated':
      return {
        leftBrow: 'M148 160 Q174 148 198 156',
        rightBrow: 'M222 156 Q246 148 272 160',
        mouth: 'M188 244 Q210 234 232 244',
        eyeOpen: 1,
        tilt: 0,
        slump: 8,
      };
    case 'fatigued':
      return {
        leftBrow: 'M148 156 Q174 154 198 156',
        rightBrow: 'M222 156 Q246 154 272 156',
        mouth: 'M190 240 Q210 238 230 240',
        eyeOpen: 0.45,
        tilt: 3,
        slump: 16,
      };
    case 'reassured':
      return {
        leftBrow: 'M148 150 Q174 144 198 150',
        rightBrow: 'M222 150 Q246 144 272 150',
        mouth: 'M186 236 Q210 250 234 236',
        eyeOpen: 1,
        tilt: 0,
        slump: 0,
      };
    default:
      return {
        leftBrow: 'M148 152 Q174 150 198 152',
        rightBrow: 'M222 152 Q246 150 272 152',
        mouth: 'M188 238 Q210 242 232 238',
        eyeOpen: 1,
        tilt: 0,
        slump: 0,
      };
  }
}

export function VirtualClient({ emotion, name, reducedMotion }: VirtualClientProps) {
  const face = features(emotion);
  const speaking = emotion === 'speaking';
  const eyeHeight = 9 * face.eyeOpen;

  return (
    <figure className="client-stage" data-testid="virtual-client" data-emotion={emotion}>
      <svg
        className="client-svg"
        viewBox="0 0 420 420"
        role="img"
        aria-labelledby="client-title client-desc"
      >
        <title id="client-title">{`${name} (${copy.clientFictional})`}</title>
        <desc id="client-desc">{`Stilstaande illustratie van ${name}, een fictieve volwassen man. Huidige uitdrukking: ${copy.emotionLabels[emotion]}.`}</desc>
        <rect width="420" height="420" fill="#ffffff" />
        <g
          className={reducedMotion ? undefined : 'breath'}
          transform={`translate(0 ${String(face.slump)}) rotate(${String(face.tilt)} 210 220)`}
        >
          <ellipse cx="210" cy="330" rx="120" ry="58" fill="#e7eef0" />
          <path
            d="M96 248 C128 214 292 214 324 248 L314 358 C248 392 172 392 106 358 Z"
            fill="#0b6e7a"
          />
          <path d="M186 252 L210 312 L234 252 Z" fill="#d7e4e7" />
          <ellipse cx="118" cy="198" rx="16" ry="24" fill="#e2b898" />
          <ellipse cx="302" cy="198" rx="16" ry="24" fill="#e2b898" />
          <circle cx="210" cy="176" r="84" fill="#e6c2a6" />
          <path d="M140 128 C168 84 252 80 282 126 C250 114 190 114 140 128 Z" fill="#7a6a5c" />
          <path
            d="M138 132 C150 118 172 112 186 128"
            fill="none"
            stroke="#6b5c50"
            strokeWidth="6"
          />
          <path
            d="M234 128 C250 112 274 118 284 134"
            fill="none"
            stroke="#6b5c50"
            strokeWidth="6"
          />
          <ellipse cx="176" cy="184" rx="15" ry={eyeHeight} fill="#ffffff" />
          <ellipse cx="244" cy="184" rx="15" ry={eyeHeight} fill="#ffffff" />
          <circle cx="176" cy="184" r="4.5" fill="#2c3a43" />
          <circle cx="244" cy="184" r="4.5" fill="#2c3a43" />
          <g
            className={reducedMotion ? undefined : 'blink'}
            style={{ transformOrigin: '210px 184px' }}
          >
            <path
              d="M161 176 Q176 170 191 176"
              fill="none"
              stroke="#d4ae94"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M229 176 Q244 170 259 176"
              fill="none"
              stroke="#d4ae94"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>
          <path
            d={face.leftBrow}
            fill="none"
            stroke="#4f433a"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d={face.rightBrow}
            fill="none"
            stroke="#4f433a"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path d="M204 196 Q210 208 218 196" fill="none" stroke="#c39986" strokeWidth="3" />
          <path d={face.mouth} fill="none" stroke="#9a5b4c" strokeWidth="5" strokeLinecap="round" />
          {speaking ? (
            <ellipse cx="210" cy="242" rx="12" ry="8" fill="#7a3f38" opacity="0.28" />
          ) : null}
        </g>
      </svg>
      <figcaption className="client-name">
        {name} <span className="badge">{copy.clientFictional}</span>
      </figcaption>
      <p className="muted" data-testid="client-emotion">
        {speaking ? <span className="speaking-dot" aria-hidden="true" /> : null}
        {copy.emotionLive}: {copy.emotionLabels[emotion]}
      </p>
    </figure>
  );
}
