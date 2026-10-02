export interface FollowTarget {
  id: string;
  done: boolean;
}

// Een echte lijn wint. Zonder lijn volgt de volgende in de lijst, en daarna het einde.
export function followList(
  ids: readonly string[],
  currentId: string,
  linkedId: string,
  endId: string,
): FollowTarget {
  if (linkedId && linkedId !== endId && ids.includes(linkedId)) {
    return { id: linkedId, done: false };
  }
  const index = ids.indexOf(currentId);
  const nextId = index >= 0 ? ids[index + 1] : undefined;
  if (nextId) {
    return { id: nextId, done: false };
  }
  return { id: currentId, done: true };
}
