export function calculateNextStock(current: number, delta: number): number {
  return current + delta;
}

export function assertNonNegativeStock(
  current: number,
  delta: number,
  allowNegative: boolean,
): number {
  const next = calculateNextStock(current, delta);
  if (!allowNegative && next < 0) {
    throw new Error('Inventory movement would result in negative stock.');
  }
  return next;
}
