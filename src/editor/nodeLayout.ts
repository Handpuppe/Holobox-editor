import type { NodeLayout } from '../domain/types';

export function parseNodeLayout(value: unknown): NodeLayout | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const layout: NodeLayout = {};
  for (const [key, point] of Object.entries(value)) {
    if (!key || !point || typeof point !== 'object' || Array.isArray(point)) {
      continue;
    }
    const x = (point as { x?: unknown }).x;
    const y = (point as { y?: unknown }).y;
    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      continue;
    }
    layout[key] = { x, y };
  }
  return Object.keys(layout).length > 0 ? layout : undefined;
}

export function sameNodeLayout(left: NodeLayout | undefined, right: NodeLayout): boolean {
  const current = left ?? {};
  const keys = Object.keys(right);
  if (Object.keys(current).length !== keys.length) {
    return false;
  }
  return keys.every(
    (key) => current[key]?.x === right[key]?.x && current[key]?.y === right[key]?.y,
  );
}
