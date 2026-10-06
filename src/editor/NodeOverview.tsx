import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import type { NodeLayout, OptionQuality } from '../domain/types';
import {
  NODE_ANSWER_FALLBACK_HEIGHT,
  NODE_ANSWER_GAP,
  NODE_ANSWER_WIDTH,
  NODE_PORT_COLOR,
  NODE_QUESTION_FALLBACK_HEIGHT,
  NODE_QUESTION_WIDTH,
  NODE_ROW_GAP,
  alignFlowCards,
  parseFlowOutput,
  placeMissingCards,
  wireMidpoint,
  wirePath,
  type NodeOverviewModel,
  type NodeQuestionView,
  type WireRect,
} from './nodeBoard';
import { sameNodeLayout } from './nodeLayout';
import { ANSWER_FOLDER_NAMES, ANSWER_VIDEO_QUALITIES } from './nursingAnswerMedia';
import './nodeOverview.css';

export interface NodeEditTarget {
  stepId: string;
  quality: OptionQuality | null;
}

interface NodeOverviewProps {
  model: NodeOverviewModel;
  onClose: () => void;
  onConnect?: (from: string, to: string) => void;
  onDisconnect?: (from: string) => void;
  onOpenTasks?: () => void;
  onCreateQuestion?: () => void;
  onDeleteQuestion?: (stepId: string) => void;
  onUndo?: () => void;
  canUndo?: boolean;
  savedLayout?: NodeLayout;
  onLayoutChange?: (layout: NodeLayout) => void;
  renderQuestionWizard?: (stepId: string, close: () => void) => ReactNode;
  renderNodeEdit?: (target: NodeEditTarget, close: () => void) => ReactNode;
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
    >
      <span className="node-port-word node-port-word-out">Uit</span>
    </span>
  );
}

function NodeCardMenu({
  stepId,
  disabled,
  onDelete,
}: {
  stepId: string;
  disabled: boolean;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="node-card-menu">
      <button
        type="button"
        className="node-card-menu-button"
        aria-label="Menu"
        aria-expanded={open}
        data-testid={`btn-node-menu-${stepId}`}
        onClick={() => setOpen((value) => !value)}
      >
        ⋯
      </button>
      {open ? (
        <button
          type="button"
          className="node-card-menu-item"
          data-testid={`btn-node-delete-${stepId}`}
          disabled={disabled}
          onClick={() => {
            setOpen(false);
            if (!disabled) {
              onDelete();
            }
          }}
        >
          Verwijderen
        </button>
      ) : null}
    </div>
  );
}

function QuestionCard({
  row,
  firstQuestion,
  dragging,
  point,
  moving,
  front,
  selected,
  canDelete,
  onOutputPointerDown,
  onCardPointerDown,
  onCardPointerEnter,
  onOpenEmpty,
  onDelete,
  onEdit,
}: {
  row: NodeQuestionView;
  firstQuestion: boolean;
  dragging: boolean;
  point: CardPoint | null;
  moving: boolean;
  front: boolean;
  selected: boolean;
  canDelete: boolean;
  onOutputPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onCardPointerDown: (cardId: string, event: ReactPointerEvent<HTMLElement>) => void;
  onCardPointerEnter: (cardId: string) => void;
  onOpenEmpty?: (stepId: string) => void;
  onDelete?: (stepId: string) => void;
  onEdit?: (target: NodeEditTarget) => void;
}) {
  const cardId = `q:${row.id}`;
  return (
    <article
      className={`node-card node-card-question${point ? ' is-placed' : ''}${moving ? ' is-moving' : ''}${front ? ' is-front' : ''}${selected ? ' is-selected' : ''}${row.empty ? ' is-empty' : ''}`}
      data-testid={`node-question-${row.id}`}
      data-node-card={cardId}
      data-drop-step={row.id}
      data-selected={selected ? 'true' : 'false'}
      style={point ? { left: point.x, top: point.y } : undefined}
      onPointerEnter={() => onCardPointerEnter(cardId)}
      onPointerDown={(event) => onCardPointerDown(cardId, event)}
    >
      <span
        className={`node-port node-port-in${dragging ? ' is-target' : ''}`}
        data-port={row.inPort}
        data-port-kind="input"
        style={{ background: NODE_PORT_COLOR.high }}
      >
        <span className="node-port-word node-port-word-in">
          {firstQuestion ? 'Scenario In' : 'In'}
        </span>
      </span>
      <header className="node-card-head">
        <span className="node-card-title">{row.title}</span>
        <span className="node-card-tools">
          <button
            type="button"
            className="node-card-edit"
            data-testid={`btn-node-edit-${row.id}`}
            onClick={() => onEdit?.({ stepId: row.id, quality: null })}
          >
            Bewerken
          </button>
          {onDelete ? (
            <NodeCardMenu stepId={row.id} disabled={!canDelete} onDelete={() => onDelete(row.id)} />
          ) : null}
        </span>
      </header>
      <div className="node-card-body">
        {row.empty ? (
          <button
            type="button"
            className="node-empty-mark"
            data-testid={`btn-node-empty-${row.id}`}
            onClick={() => onOpenEmpty?.(row.id)}
          >
            Leeg
          </button>
        ) : (
          <>
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
          </>
        )}
      </div>
    </article>
  );
}

function cardHitsMarquee(
  id: string,
  point: CardPoint,
  rect: WireRect,
  sizer: HTMLElement,
): boolean {
  let left = point.x;
  let top = point.y;
  let right = point.x + (id.startsWith('a:') ? NODE_ANSWER_WIDTH : NODE_QUESTION_WIDTH);
  let bottom =
    point.y + (id.startsWith('a:') ? NODE_ANSWER_FALLBACK_HEIGHT : NODE_QUESTION_FALLBACK_HEIGHT);
  let card: HTMLElement | null = null;
  for (const item of sizer.querySelectorAll<HTMLElement>('[data-node-card]')) {
    if (item.dataset.nodeCard === id) {
      card = item;
      break;
    }
  }
  if (card) {
    const box = card.getBoundingClientRect();
    if (box.width >= 2 && box.height >= 2) {
      const origin = sizer.getBoundingClientRect();
      left = box.left - origin.left;
      top = box.top - origin.top;
      right = box.right - origin.left;
      bottom = box.bottom - origin.top;
    }
  }
  return left < rect.right && right > rect.left && top < rect.bottom && bottom > rect.top;
}

function readCardRects(sizer: HTMLElement): WireRect[] {
  const origin = sizer.getBoundingClientRect();
  const rects: WireRect[] = [];
  for (const card of sizer.querySelectorAll<HTMLElement>('[data-node-card]')) {
    const box = card.getBoundingClientRect();
    if (box.width < 2 || box.height < 2) {
      continue;
    }
    rects.push({
      left: box.left - origin.left,
      top: box.top - origin.top,
      right: box.right - origin.left,
      bottom: box.bottom - origin.top,
    });
  }
  return rects;
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

// De poort is 14px. Een loslating op de vraagkaart telt als Scenario In.
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
  selected,
  onOutputPointerDown,
  onCardPointerDown,
  onCardPointerEnter,
  onEdit,
}: {
  rowId: string;
  answer: NodeQuestionView['answers'][number];
  point: CardPoint | null;
  moving: boolean;
  front: boolean;
  selected: boolean;
  onOutputPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onCardPointerDown: (cardId: string, event: ReactPointerEvent<HTMLElement>) => void;
  onCardPointerEnter: (cardId: string) => void;
  onEdit?: (target: NodeEditTarget) => void;
}) {
  const color = NODE_PORT_COLOR[answer.quality];
  const cardId = `a:${rowId}:${answer.quality}`;
  return (
    <article
      className={`node-card node-card-answer${point ? ' is-placed' : ''}${moving ? ' is-moving' : ''}${front ? ' is-front' : ''}${selected ? ' is-selected' : ''}`}
      data-testid={`node-answer-${rowId}-${answer.quality}`}
      data-node-card={cardId}
      data-selected={selected ? 'true' : 'false'}
      style={point ? { left: point.x, top: point.y } : undefined}
      onPointerEnter={() => onCardPointerEnter(cardId)}
      onPointerDown={(event) => onCardPointerDown(cardId, event)}
    >
      <span
        className="node-port node-port-in"
        data-port={answer.inPort}
        data-port-kind="input"
        style={{ background: color }}
      >
        <span className="node-port-word node-port-word-in">In</span>
      </span>
      <OutputPort port={answer.outPort} color={color} onPointerDown={onOutputPointerDown} />
      <header className="node-card-head">
        <span className="node-card-title">{answer.title}</span>
        <button
          type="button"
          className="node-card-edit"
          data-testid={`btn-node-edit-${rowId}-${answer.quality}`}
          onClick={() => onEdit?.({ stepId: rowId, quality: answer.quality })}
        >
          Bewerken
        </button>
      </header>
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

function cardIdsOf(model: NodeOverviewModel): string[] {
  const ids: string[] = [];
  for (const row of model.rows) {
    ids.push(`q:${row.id}`);
    if (row.empty) {
      continue;
    }
    for (const answer of row.answers) {
      ids.push(`a:${row.id}:${answer.quality}`);
    }
  }
  return ids;
}

function mergeLayout(
  current: { key: string; cards: Record<string, CardPoint> },
  layoutKey: string,
  cardIds: string[],
  heights: Readonly<Record<string, number>> = {},
): { key: string; cards: Record<string, CardPoint> } {
  const cards = placeMissingCards(current.cards, cardIds, heights);
  if (current.key === layoutKey && sameNodeLayout(current.cards, cards)) {
    return current;
  }
  return { key: layoutKey, cards };
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
    const cardWidth = id.startsWith('a:') ? NODE_ANSWER_WIDTH : NODE_QUESTION_WIDTH;
    const cardHeight = id.startsWith('a:')
      ? NODE_ANSWER_FALLBACK_HEIGHT
      : NODE_QUESTION_FALLBACK_HEIGHT;
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
  onCreateQuestion,
  onDeleteQuestion,
  onUndo,
  canUndo = false,
  savedLayout,
  onLayoutChange,
  renderQuestionWizard,
  renderNodeEdit,
}: NodeOverviewProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const sizerRef = useRef<HTMLDivElement>(null);
  const onConnectRef = useRef(onConnect);
  const stopDrag = useRef<(() => void) | null>(null);
  const stopCardDrag = useRef<(() => void) | null>(null);
  const [drawn, setDrawn] = useState<DrawnWire[]>([]);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [movingCardId, setMovingCardId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [marquee, setMarquee] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [frontCardId, setFrontCardId] = useState<string | null>(null);
  const [wizardStepId, setWizardStepId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<NodeEditTarget | null>(null);
  const layoutKey = layoutKeyOf(model);
  const cardIdKey = cardIdsOf(model).join('|');
  const cardIds = useMemo(() => (cardIdKey ? cardIdKey.split('|') : []), [cardIdKey]);
  const [layoutPositions, setLayoutPositions] = useState<{
    key: string;
    cards: Record<string, CardPoint>;
  }>(() => ({
    key: layoutKeyOf(model),
    cards: savedLayout ?? {},
  }));
  const layoutRef = useRef(layoutPositions);
  const onLayoutChangeRef = useRef(onLayoutChange);
  const cardIdsRef = useRef(cardIds);
  const layoutKeyRef = useRef(layoutKey);
  const positions = useMemo(() => {
    if (!layoutPositions) {
      return null;
    }
    return mergeLayout(layoutPositions, layoutKey, cardIds).cards;
  }, [cardIds, layoutKey, layoutPositions]);
  const activeWizardId =
    wizardStepId && model.rows.some((row) => row.id === wizardStepId) ? wizardStepId : null;
  const activeEdit =
    editTarget && model.rows.some((row) => row.id === editTarget.stepId) ? editTarget : null;

  useEffect(() => {
    onConnectRef.current = onConnect;
    onLayoutChangeRef.current = onLayoutChange;
    cardIdsRef.current = cardIds;
    layoutKeyRef.current = layoutKey;
  });

  function commitLayout(current: { key: string; cards: Record<string, CardPoint> } | null) {
    if (!current) {
      return;
    }
    const merged = mergeLayout(current, layoutKeyRef.current, cardIdsRef.current).cards;
    onLayoutChangeRef.current?.(merged);
  }

  function alignBoard() {
    const heights: Record<string, number> = {};
    const sizer = sizerRef.current;
    if (sizer) {
      for (const card of sizer.querySelectorAll<HTMLElement>('[data-node-card]')) {
        const id = card.dataset.nodeCard ?? '';
        const height = card.getBoundingClientRect().height;
        if (id && height >= 2) {
          heights[id] = height;
        }
      }
    }
    const cards = alignFlowCards(model.rows, heights);
    const next = { key: layoutKey, cards };
    layoutRef.current = next;
    setLayoutPositions(next);
    setSelectedIds([]);
    onLayoutChangeRef.current?.(cards);
  }

  useEffect(() => {
    return () => {
      stopDrag.current?.();
      stopCardDrag.current?.();
      commitLayout(layoutRef.current);
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
        d: wirePath(start.x, start.y, end.x, end.y, readCardRects(sizer)),
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
      }
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
    const group = selectedIds.includes(cardId) ? selectedIds : [cardId];
    const origins: Record<string, CardPoint> = {};
    for (const id of group) {
      const point = snapshot[id];
      if (point) {
        origins[id] = point;
      }
    }
    if (!origins[cardId]) {
      return;
    }
    if (!selectedIds.includes(cardId)) {
      setSelectedIds([cardId]);
    }
    const initial = { key: layoutKey, cards: snapshot };
    layoutRef.current = initial;
    setMovingCardId(cardId);
    setLayoutPositions(initial);
    stopCardDrag.current?.();
    const move = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      const previous = layoutRef.current?.key === layoutKey ? layoutRef.current.cards : snapshot;
      const cards = { ...previous };
      for (const [id, start] of Object.entries(origins)) {
        cards[id] = { x: start.x + dx, y: start.y + dy };
      }
      const next = { key: layoutKey, cards };
      layoutRef.current = next;
      setLayoutPositions(next);
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      stopCardDrag.current = null;
      commitLayout(layoutRef.current);
      setMovingCardId(null);
    };
    stopCardDrag.current = stop;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  }

  function onBoardPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest('[data-node-card], button, a, .node-port, .node-wire-delete')
    ) {
      return;
    }
    const sizer = sizerRef.current;
    if (!sizer) {
      return;
    }
    const box = sizer.getBoundingClientRect();
    const pointAt = (clientX: number, clientY: number) => ({
      x: clientX - box.left,
      y: clientY - box.top,
    });
    const start = pointAt(event.clientX, event.clientY);
    let current = start;
    const paint = () => {
      setMarquee({
        x: Math.min(start.x, current.x),
        y: Math.min(start.y, current.y),
        width: Math.abs(current.x - start.x),
        height: Math.abs(current.y - start.y),
      });
    };
    paint();
    const move = (moveEvent: PointerEvent) => {
      current = pointAt(moveEvent.clientX, moveEvent.clientY);
      paint();
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setMarquee(null);
      const width = Math.abs(current.x - start.x);
      const height = Math.abs(current.y - start.y);
      if (width < 4 && height < 4) {
        setSelectedIds([]);
        return;
      }
      const rect = {
        left: Math.min(start.x, current.x),
        top: Math.min(start.y, current.y),
        right: Math.max(start.x, current.x),
        bottom: Math.max(start.y, current.y),
      };
      const cards = positions ?? {};
      const hits = Object.entries(cards)
        .filter(([id, point]) => cardHitsMarquee(id, point, rect, sizer))
        .map(([id]) => id);
      setSelectedIds(hits);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
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
      if (layoutPositions) {
        const heights: Record<string, number> = {};
        for (const card of sizer.querySelectorAll<HTMLElement>('[data-node-card]')) {
          const id = card.dataset.nodeCard ?? '';
          const height = card.getBoundingClientRect().height;
          if (id && height >= 2) {
            heights[id] = height;
          }
        }
        if (Object.keys(heights).length > 0) {
          const placed = mergeLayout(layoutPositions, layoutKey, cardIds, heights);
          if (placed !== layoutPositions) {
            layoutRef.current = placed;
            setLayoutPositions(placed);
          }
        }
      }
      const origin = sizer.getBoundingClientRect();
      const obstacles = readCardRects(sizer);
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
        const mid = wireMidpoint(x1, y1, x2, y2, obstacles);
        next.push({
          key: `${wire.from}-${wire.to}`,
          from: wire.from,
          to: wire.to,
          d: wirePath(x1, y1, x2, y2, obstacles),
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
  }, [cardIds, layoutKey, layoutPositions, model, positions]);

  const extent = canvasExtent(positions);

  return (
    <div
      className={`node-overview${dragPreview ? ' is-dragging' : ''}${movingCardId ? ' is-moving-card' : ''}`}
      data-testid="node-overview"
      style={
        {
          '--node-row-gap': `${NODE_ROW_GAP}px`,
          '--node-answer-gap': `${NODE_ANSWER_GAP}px`,
          '--node-question-head': '#243044',
          '--node-answer-head': '#6b5200',
          '--node-board-bg': '#141414',
        } as CSSProperties
      }
    >
      <div className="node-overview-bar">
        <button
          type="button"
          className="btn btn-secondary"
          data-testid="btn-node-undo"
          onClick={onUndo}
          disabled={!canUndo}
        >
          Undo
        </button>
        {onCreateQuestion ? (
          <button
            type="button"
            className="btn"
            data-testid="btn-node-new-question"
            onClick={onCreateQuestion}
          >
            Nieuwe vraag
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-secondary"
          data-testid="btn-nodes-back"
          onClick={onClose}
        >
          Terug naar editor
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          data-testid="btn-task-list"
          onClick={onOpenTasks}
        >
          Takenlijst
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          data-testid="btn-node-align"
          onClick={alignBoard}
        >
          Uitlijnen
        </button>
        <p className="node-overview-hint">
          Sleep op de lege achtergrond om nodes te selecteren. Sleep een kaart om hem te
          verplaatsen. Sleep een uitgang naar Scenario In. Het kruisje haalt de lijn weg.
        </p>
      </div>
      <div
        className="node-canvas"
        data-testid="node-canvas"
        ref={canvasRef}
        onPointerDown={onBoardPointerDown}
      >
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
          {marquee && marquee.width > 0 && marquee.height > 0 ? (
            <div
              className="node-marquee"
              data-testid="node-marquee"
              style={{
                left: marquee.x,
                top: marquee.y,
                width: marquee.width,
                height: marquee.height,
              }}
            />
          ) : null}
          {model.rows.map((row, index) => (
            <section
              key={row.id}
              className={`node-row${positions ? ' is-placed' : ''}`}
              data-testid={`node-row-${row.id}`}
            >
              <QuestionCard
                row={row}
                firstQuestion={index === 0}
                dragging={dragPreview !== null}
                point={positions?.[`q:${row.id}`] ?? null}
                moving={movingCardId === `q:${row.id}`}
                front={frontCardId === `q:${row.id}`}
                selected={selectedIds.includes(`q:${row.id}`)}
                canDelete={model.rows.length > 1}
                onOutputPointerDown={onOutputPointerDown}
                onCardPointerDown={onCardPointerDown}
                onCardPointerEnter={setFrontCardId}
                onOpenEmpty={
                  renderQuestionWizard
                    ? (stepId) => {
                        setEditTarget(null);
                        setWizardStepId(stepId);
                      }
                    : undefined
                }
                onDelete={onDeleteQuestion}
                onEdit={
                  renderNodeEdit
                    ? (target) => {
                        setWizardStepId(null);
                        setEditTarget(target);
                      }
                    : undefined
                }
              />
              {row.empty ? null : (
                <div className="node-answers">
                  {row.answers.map((answer) => (
                    <AnswerCard
                      key={answer.quality}
                      rowId={row.id}
                      answer={answer}
                      point={positions?.[`a:${row.id}:${answer.quality}`] ?? null}
                      moving={movingCardId === `a:${row.id}:${answer.quality}`}
                      front={frontCardId === `a:${row.id}:${answer.quality}`}
                      selected={selectedIds.includes(`a:${row.id}:${answer.quality}`)}
                      onOutputPointerDown={onOutputPointerDown}
                      onCardPointerDown={onCardPointerDown}
                      onCardPointerEnter={setFrontCardId}
                      onEdit={
                        renderNodeEdit
                          ? (target) => {
                              setWizardStepId(null);
                              setEditTarget(target);
                            }
                          : undefined
                      }
                    />
                  ))}
                </div>
              )}
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
      {activeWizardId && renderQuestionWizard
        ? renderQuestionWizard(activeWizardId, () => setWizardStepId(null))
        : null}
      {activeEdit && renderNodeEdit ? renderNodeEdit(activeEdit, () => setEditTarget(null)) : null}
    </div>
  );
}
