export type SortDirection = 'asc' | 'desc';

export type SortState<TKey extends string = string> = {
  direction: SortDirection;
  key: TKey;
};

export function compareSortValues(left: unknown, right: unknown, direction: SortDirection) {
  const multiplier = direction === 'asc' ? 1 : -1;
  const leftEmpty = left === null || left === undefined || left === '';
  const rightEmpty = right === null || right === undefined || right === '';
  if (leftEmpty && rightEmpty) return 0;
  if (leftEmpty) return 1;
  if (rightEmpty) return -1;

  const leftNumber = typeof left === 'number' ? left : Number(left);
  const rightNumber = typeof right === 'number' ? right : Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return (leftNumber - rightNumber) * multiplier;
  }

  const leftTime = typeof left === 'string' ? Date.parse(left) : Number.NaN;
  const rightTime = typeof right === 'string' ? Date.parse(right) : Number.NaN;
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
    return (leftTime - rightTime) * multiplier;
  }

  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' }) * multiplier;
}

export function sortRows<TItem>(items: TItem[], sort: SortState | null, getValue: (item: TItem, key: string) => unknown) {
  if (!sort) return items;
  return [...items].sort((left, right) => compareSortValues(getValue(left, sort.key), getValue(right, sort.key), sort.direction));
}

export function nextSortState<TKey extends string>(current: SortState<TKey> | null, key: TKey): SortState<TKey> {
  return {
    direction: current?.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    key
  };
}
