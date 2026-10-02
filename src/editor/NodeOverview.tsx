import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  NODE_PORT_COLOR,
  parseFlowOutput,
  wireMidpoint,
  wirePath,
  type NodeOverviewModel,
  type NodeQuestionView,
} from './nodeBoard';
import { ANSWER_FOLDER_NAMES, ANSWER_VIDEO_QUALITIES } from './nursingAnswerMedia';
import './nodeOverview.css';

interface NodeOverviewProps {
  model: NodeOverviewModel;
  onClose: () => void;
  onConnect?: (from: string, to: string) => void;
  onDisconnect?: (from: string) => void;
  onOpenTasks?: () => void;
}

interface CardPoint {
  x: number;
  y: number;
}

interface DrawnWire {
  key: string;
  from: string;
  to: string;
  d: string;
  color: string;
  removable: boolean;
  mx: number;
  my: number;
}

interface DragPreview {
  from: string;
  d: string;
  color: string;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="node-field">
      <p className="node-field-label">{label}</p>
      <p className="node-field-value">{value}</p>
    </div>
  );
}

function OutputPort({
  port,
  color,
  onPointerDown,
}: {
  port: string;
  color: string;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
}) {
  return (
    <span
      className="node-port node-port-out"
      data-port={port}
      data-port-kind="output"
      style={{ background: color }}
      onPointerDown={onPointerDown}
    />
  );
}

function QuestionCard({
  row,
  dragging,
  point,
  moving,
  front,
  onOutputPointerDown,
  onCardPointerDown,
  onCardPointerEnter,
}: {
  row: NodeQuestionView;
  dragging: boolean;
  point: CardPoint | null;
  moving: boolean;
  front: boolean;
  onOutputPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onCardPointerDown: (cardId: string, event: ReactPointerEvent<HTMLElement>) => void;
  onCardPointerEnter: (cardId: string) => void;
}) {
  const cardId = `q:${row.id}`;
  return (
    <article
      className={`node-card node-card-question${point ? ' is-placed' : ''}${moving ? ' is-moving' : ''}${front ? ' is-front' : ''}`}
      data-testid={`node-question-${row.id}`}
      data-node-card={cardId}
      data-drop-step={row.id}
      style={point ? { left: point.x, top: point.y } : undefined}
      onPointerEnter={() => onCardPointerEnter(cardId)}
      onPointerDown={(event) => onCardPointerDown(cardId, event)}
    >
      <span className="node-port-caption">Scenario input</span>
      <span
        className={`node-port node-port-in${dragging ? ' is-target' : ''}`}
        data-port={row.inPort}
        data-port-kind="input"
        style={{ background: NODE_PORT_COLOR.high }}
      />
      <header className="node-card-head">{row.title}</header>
      <div className="node-card-body">
        <Field label="Scenario" value={row.scenario} />
        <Field label="Onderdeel" value={row.onderdeel} />
        <Field label="Vraag" value={row.vraag} />
        <ul className="node-exits">
          {ANSWER_VIDEO_QUALITIES.map((quality) => (
            <li key={quality}>
              <span>{ANSWER_FOLDER_NAMES[quality]}</span>
              <OutputPort
                port={`q-out-${row.id}-${quality}`}
                color={NODE_PORT_COLOR[quality]}
                onPointerDown={onOutputPointerDown}
              />
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function portName(element: Element | null): string {
  if (!(element instanceof Element)) {
    return '';
  }
  return element.closest('[data-port]')?.getAttribute('data-port') ?? '';
}

function questionInput(element: Element | null): string {
  if (!(element instanceof Element) || element.closest('.node-card-answer')) {
    return '';
  }
  const stepId = element.closest('[data-drop-step]')?.getAttribute('data-drop-step') ?? '';
  return stepId ? `q-in-${stepId}` : '';
}

// De poort is 14px. Een loslating op de vraagkaart telt als Scenario input.
function resolveDropTarget(clientX: number, clientY: number): string {
  const hit =
    typeof document.elementFromPoint === 'function'
      ? document.elementFromPoint(clientX, clientY)
      : null;
  const direct = portName(hit instanceof Element ? hit : null);
  if (direct.startsWith('q-in-')) {
    return direct;
  }
  if (hit instanceof Element && hit.closest('.node-card-answer')) {
    return '';
  }
  const card = questionInput(hit instanceof Element ? hit : null);
  if (card) {
    return card;
  }
  const stack =
    typeof document.elementsFromPoint === 'function'
      ? document.elementsFromPoint(clientX, clientY)
      : [];
  for (const element of stack) {
    if (element.closest('.node-card-answer')) {
      continue;
    }
    const port = portName(element);
    if (port.startsWith('q-in-')) {
      return port;
    }
    const fromCard = questionInput(element);
    if (fromCard) {
      return fromCard;
    }
  }
  return '';
}

function AnswerCard({
  rowId,
  answer,
  point,
  moving,
  front,
  onOutputPointerDown,
  onCardPointerDown,
  onCardPointerEnter,
}: {
  rowId: string;
  answer: NodeQuestionView['answers'][number];
  point: CardPoint | null;
  moving: boolean;
  front: boolean;
  onOutputPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onCardPointerDown: (cardId: string, event: ReactPointerEvent<HTMLElement>) => void;
  onCardPointerEnter: (cardId: string) => void;
}) {
  const color = NODE_PORT_COLOR[answer.quality];
  const cardId = `a:${rowId}:${answer.quality}`;
  return (
    <article
      className={`node-card node-card-answer${point ? ' is-placed' : ''}${moving ? ' is-moving' : ''}${front ? ' is-front' : ''}`}
      data-testid={`node-answer-${rowId}-${answer.quality}`}
      data-node-card={cardId}
      style={point ? { left: point.x, top: point.y } : undefined}
      onPointerEnter={() => onCardPointerEnter(cardId)}
      onPointerDown={(event) => onCardPointerDown(cardId, event)}
    >
      <span
        className="node-port node-port-in"
        data-port={answer.inPort}
        data-port-kind="input"
        style={{ background: color }}
      />
      <OutputPort port={answer.outPort} color={color} onPointerDown={onOutputPointerDown} />
      <header className="node-card-head">{answer.title}</header>
      <div className="node-card-body">
        <Field label="Scenario" value={answer.scenario} />
        <Field label="Onderdeel" value={answer.onderdeel} />
        {answer.showMedia ? <Field label={answer.mediaLabel} value={answer.mediaText} /> : null}
      </div>
    </article>
  );
}

function layoutKeyOf(model: NodeOverviewModel): string {
  return model.rows
    .map((row) => `${row.id}:${row.answers.map((answer) => answer.quality).join(',')}`)
    .join('|');
}

function canvasExtent(
  cards: Record<string, CardPoint> | null,
): { width: number; height: number } | null {
  if (!cards) {
    return null;
  }
  let width = 720;
  let height = 640;
  for (const [id, point] of Object.entries(cards)) {
    const cardWidth = id.startsWith('a:') ? 250 : 300;
    const cardHeight = id.startsWith('a:') ? 200 : 320;
    width = Math.max(width, point.x + cardWidth + 120);
    height = Math.max(height, point.y + cardHeight + 80);
  }
  return { width, height };
}

export function NodeOverview({
  model,
  onClose,
  onConnect,
  onDisconnect,
  onOpenTasks,
}: NodeOverviewProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const sizerRef = useRef<HTMLDivElement>(null);
  const onConnectRef = useRef(onConnect);
  const stopDrag = useRef<(() => void) | null>(null);
  const stopCardDrag = useRef<(() => void) | null>(null);
  const [drawn, setDrawn] = useState<DrawnWire[]>([]);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [movingCardId, setMovingCardId] = useState<string | null>(null);
  const [frontCardId, setFrontCardId] = useState<string | null>(null);
  const layoutKey = layoutKeyOf(model);
  const [layoutPositions, setLayoutPositions] = useState<{
    key: string;
    cards: Record<string, CardPoint>;
  } | null>(null);
  const positions = layoutPositions?.key === layoutKey ? layoutPositions.cards : null;

  useEffect(() => {
    onConnectRef.current = onConnect;
  });

  useEffect(() => {
    return () => {
      stopDrag.current?.();
      stopCardDrag.current?.();
    };
  }, []);

  function readFlowPositions(): Record<string, CardPoint> | null {
    const sizer = sizerRef.current;
    if (!sizer) {
      return null;
    }
    const origin = sizer.getBoundingClientRect();
    const cards: Record<string, CardPoint> = {};
    for (const card of sizer.querySelectorAll<HTMLElement>('[data-node-card]')) {
      const id = card.dataset.nodeCard ?? '';
      if (!id) {
        continue;
      }
      const box = card.getBoundingClientRect();
      cards[id] = {
        x: box.left - origin.left,
        y: box.top - origin.top,
      };
    }
    return Object.keys(cards).length > 0 ? cards : null;
  }

  function onOutputPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0) {
      return;
    }
    const from = event.currentTarget.dataset.port ?? '';
    const parsed = parseFlowOutput(from);
    const canvas = canvasRef.current;
    const sizer = sizerRef.current;
    if (!parsed || !canvas || !sizer) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const contentPoint = (clientX: number, clientY: number) => {
      const box = sizer.getBoundingClientRect();
      return {
        x: clientX - box.left,
        y: clientY - box.top,
      };
    };
    const rect = event.currentTarget.getBoundingClientRect();
    const start = contentPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const preview = (clientX: number, clientY: number): DragPreview => {
      const end = contentPoint(clientX, clientY);
      return {
        from,
        d: wirePath(start.x, start.y, end.x, end.y),
        color: NODE_PORT_COLOR[parsed.quality],
      };
    };
    const scrollWhileDragging = (clientY: number) => {
      const edge = 72;
      let delta = 0;
      if (clientY < edge) {
        delta = clientY - edge;
      } else if (clientY > window.innerHeight - edge) {
        delta = clientY - (window.innerHeight - edge);
      }
      if (delta === 0) {
        return;
      }
      const step = Math.max(-36, Math.min(36, delta));
      if (canvas.scrollHeight > canvas.clientHeight + 1) {
        canvas.scrollBy(0, step);
        return;
      }
      window.scrollBy(0, step);
    };
    setDragPreview(preview(event.clientX, event.clientY));
    stopDrag.current?.();
    const move = (moveEvent: PointerEvent) => {
      scrollWhileDragging(moveEvent.clientY);
      setDragPreview(preview(moveEvent.clientX, moveEvent.clientY));
    };
    const up = (upEvent: PointerEvent) => {
      stop();
      const port = resolveDropTarget(upEvent.clientX, upEvent.clientY);
      if (port) {
        onConnectRef.current?.(from, port);
      }
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      stopDrag.current = null;
      setDragPreview(null);
    };
    stopDrag.current = stop;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function onCardPointerDown(cardId: string, event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element) || target.closest('.node-port, button, a')) {
      return;
    }
    const snapshot = positions ?? readFlowPositions();
    const origin = snapshot?.[cardId];
    if (!snapshot || !origin) {
      return;
    }
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    setMovingCardId(cardId);
    setLayoutPositions({ key: layoutKey, cards: snapshot });
    stopCardDrag.current?.();
    const move = (moveEvent: PointerEvent) => {
      const x = origin.x + (moveEvent.clientX - startX);
      const y = origin.y + (moveEvent.clientY - startY);
      setLayoutPositions((current) => {
        const cards = current?.key === layoutKey ? current.cards : snapshot;
        return {
          key: layoutKey,
          cards: { ...cards, [cardId]: { x, y } },
        };
      });
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      stopCardDrag.current = null;
      setMovingCardId(null);
    };
    stopCardDrag.current = stop;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  }

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const measure = () => {
      const sizer = sizerRef.current;
      if (!sizer) {
        return;
      }
      const origin = sizer.getBoundingClientRect();
      const next: DrawnWire[] = [];
      for (const wire of model.wires) {
        const from = sizer.querySelector(`[data-port="${wire.from}"]`);
        const to = sizer.querySelector(`[data-port="${wire.to}"]`);
        if (!(from instanceof HTMLElement) || !(to instanceof HTMLElement)) {
          continue;
        }
        const start = from.getBoundingClientRect();
        const end = to.getBoundingClientRect();
        const x1 = start.left + start.width / 2 - origin.left;
        const y1 = start.top + start.height / 2 - origin.top;
        const x2 = end.left + end.width / 2 - origin.left;
        const y2 = end.top + end.height / 2 - origin.top;
        const mid = wireMidpoint(x1, y1, x2, y2);
        next.push({
          key: `${wire.from}-${wire.to}`,
          from: wire.from,
          to: wire.to,
          d: wirePath(x1, y1, x2, y2),
          color: NODE_PORT_COLOR[wire.quality],
          removable: wire.removable,
          mx: mid.x,
          my: mid.y,
        });
      }
      setDrawn(next);
    };
    measure();
    canvas.addEventListener('scroll', measure);
    if (typeof ResizeObserver === 'undefined') {
      return () => canvas.removeEventListener('scroll', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      canvas.removeEventListener('scroll', measure);
    };
  }, [model, positions]);

  const extent = canvasExtent(positions);

  return (
    <div
      className={`node-overview${dragPreview ? ' is-dragging' : ''}${movingCardId ? ' is-moving-card' : ''}`}
      data-testid="node-overview"
    >
      <div className="node-overview-bar">
        <button
          type="button"
          className="btn btn-secondary"
          data-testid="btn-nodes-back"
          onClick={onClose}
        >
          Terug
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          data-testid="btn-task-list"
          onClick={onOpenTasks}
        >
          Takenlijst
        </button>
        <p className="node-overview-hint">
          Sleep een kaart om hem te verplaatsen. Sleep een uitgang naar Scenario input. Het kruisje
          haalt de lijn weg.
        </p>
      </div>
      <div className="node-canvas" ref={canvasRef}>
        <div
          className="node-canvas-sizer"
          ref={sizerRef}
          style={extent ? { width: extent.width, height: extent.height } : undefined}
        >
          <svg className="node-wires" data-testid="node-wires" aria-hidden="true">
            {drawn.map((wire) => (
              <path
                key={wire.key}
                d={wire.d}
                fill="none"
                stroke={wire.color}
                strokeWidth="2.5"
                strokeDasharray="7 6"
                strokeLinecap="round"
                data-testid={`node-wire-${wire.from}-to-${wire.to}`}
                data-wire-from={wire.from}
                data-wire-to={wire.to}
              />
            ))}
            {dragPreview ? (
              <path
                data-testid="node-wire-preview"
                d={dragPreview.d}
                fill="none"
                stroke={dragPreview.color}
                strokeWidth="2.5"
                strokeDasharray="7 6"
                strokeLinecap="round"
              />
            ) : null}
          </svg>
          {model.rows.map((row) => (
            <section
              key={row.id}
              className={`node-row${positions ? ' is-placed' : ''}`}
              data-testid={`node-row-${row.id}`}
            >
              <QuestionCard
                row={row}
                dragging={dragPreview !== null}
                point={positions?.[`q:${row.id}`] ?? null}
                moving={movingCardId === `q:${row.id}`}
                front={frontCardId === `q:${row.id}`}
                onOutputPointerDown={onOutputPointerDown}
                onCardPointerDown={onCardPointerDown}
                onCardPointerEnter={setFrontCardId}
              />
              <div className="node-answers">
                {row.answers.map((answer) => (
                  <AnswerCard
                    key={answer.quality}
                    rowId={row.id}
                    answer={answer}
                    point={positions?.[`a:${row.id}:${answer.quality}`] ?? null}
                    moving={movingCardId === `a:${row.id}:${answer.quality}`}
                    front={frontCardId === `a:${row.id}:${answer.quality}`}
                    onOutputPointerDown={onOutputPointerDown}
                    onCardPointerDown={onCardPointerDown}
                    onCardPointerEnter={setFrontCardId}
                  />
                ))}
              </div>
            </section>
          ))}
          {drawn
            .filter((wire) => wire.removable)
            .map((wire) => (
              <button
                key={wire.key}
                type="button"
                className="node-wire-delete"
                style={{ left: wire.mx, top: wire.my }}
                data-testid={`btn-delete-wire-${wire.from}`}
                aria-label="Verwijder lijn"
                title="Verwijder lijn"
                onClick={() => onDisconnect?.(wire.from)}
              >
                ×
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
