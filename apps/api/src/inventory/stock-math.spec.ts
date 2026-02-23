import { assertNonNegativeStock, calculateNextStock } from './stock-math';

describe('stock math', () => {
  it('adds delta to current stock', () => {
    expect(calculateNextStock(10, -3)).toBe(7);
    expect(calculateNextStock(10, 5)).toBe(15);
  });

  it('throws when stock goes negative without override', () => {
    expect(() => assertNonNegativeStock(2, -5, false)).toThrow(
      'Inventory movement would result in negative stock.',
    );
  });

  it('allows negative stock with override permission', () => {
    expect(assertNonNegativeStock(2, -5, true)).toBe(-3);
  });
});
