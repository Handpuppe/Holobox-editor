import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
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
  onOutputPointerDown,
}: {
  row: NodeQuestionView;
  dragging: boolean;
  onOutputPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
}) {
  return (
    <article
      className="node-card node-card-question"
      data-testid={`node-question-${row.id}`}
      data-drop-step={row.id}
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
  onOutputPointerDown,
}: {
  rowId: string;
  answer: NodeQuestionView['answers'][number];
  onOutputPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
}) {
  const color = NODE_PORT_COLOR[answer.quality];
  return (
    <article
      className="node-card node-card-answer"
      data-testid={`node-answer-${rowId}-${answer.quality}`}
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

export function NodeOverview({ model, onClose, onConnect, onDisconnect }: NodeOverviewProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const onConnectRef = useRef(onConnect);
  const stopDrag = useRef<(() => void) | null>(null);
  const [drawn, setDrawn] = useState<DrawnWire[]>([]);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);

  useEffect(() => {
    onConnectRef.current = onConnect;
  });

  useEffect(() => {
    return () => {
      stopDrag.current?.();
    };
  }, []);

  function onOutputPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0) {
      return;
    }
    const from = event.currentTarget.dataset.port ?? '';
    const parsed = parseFlowOutput(from);
    const canvas = canvasRef.current;
    if (!parsed || !canvas) {
      return;
    }
    event.preventDefault();
    const contentPoint = (clientX: number, clientY: number) => {
      const box = canvas.getBoundingClientRect();
      return {
        x: clientX - box.left + canvas.scrollLeft,
        y: clientY - box.top + canvas.scrollTop,
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

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const measure = () => {
      const origin = canvas.getBoundingClientRect();
      const next: DrawnWire[] = [];
      for (const wire of model.wires) {
        const from = canvas.querySelector(`[data-port="${wire.from}"]`);
        const to = canvas.querySelector(`[data-port="${wire.to}"]`);
        if (!(from instanceof HTMLElement) || !(to instanceof HTMLElement)) {
          continue;
        }
        const start = from.getBoundingClientRect();
        const end = to.getBoundingClientRect();
        const x1 = start.left + start.width / 2 - origin.left + canvas.scrollLeft;
        const y1 = start.top + start.height / 2 - origin.top + canvas.scrollTop;
        const x2 = end.left + end.width / 2 - origin.left + canvas.scrollLeft;
        const y2 = end.top + end.height / 2 - origin.top + canvas.scrollTop;
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
  }, [model]);

  return (
    <div className={`node-overview${dragPreview ? ' is-dragging' : ''}`} data-testid="node-overview">
      <div className="node-overview-bar">
        <button type="button" className="btn btn-secondary" data-testid="btn-nodes-back" onClick={onClose}>
          Terug
        </button>
        <p className="node-overview-hint">
          Sleep een uitgang naar Scenario input. Het kruisje haalt de lijn weg.
        </p>
      </div>
      <div className="node-canvas" ref={canvasRef}>
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
          <section key={row.id} className="node-row" data-testid={`node-row-${row.id}`}>
            <QuestionCard row={row} dragging={dragPreview !== null} onOutputPointerDown={onOutputPointerDown} />
            <div className="node-answers">
              {row.answers.map((answer) => (
                <AnswerCard
                  key={answer.quality}
                  rowId={row.id}
                  answer={answer}
                  onOutputPointerDown={onOutputPointerDown}
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
  );
}
