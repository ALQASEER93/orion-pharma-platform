import { allocateStockFefo } from './stock-allocation';

describe('allocateStockFefo', () => {
  it('allocates by earliest expiry first (FEFO)', () => {
    const result = allocateStockFefo(
      [
        {
          batchNo: 'B2',
          expiryDate: new Date('2026-12-31T00:00:00Z'),
          quantity: 5,
        },
        {
          batchNo: 'B1',
          expiryDate: new Date('2026-08-01T00:00:00Z'),
          quantity: 3,
        },
      ],
      4,
    );

    expect(result.allocations).toEqual([
      {
        batchNo: 'B1',
        expiryDate: new Date('2026-08-01T00:00:00Z'),
        quantity: 3,
      },
      {
        batchNo: 'B2',
        expiryDate: new Date('2026-12-31T00:00:00Z'),
        quantity: 1,
      },
    ]);
    expect(result.availableQty).toBe(8);
  });

  it('falls back to batch ordering when expiry is missing', () => {
    const result = allocateStockFefo(
      [
        { batchNo: 'B2', expiryDate: null, quantity: 2 },
        { batchNo: 'B1', expiryDate: null, quantity: 2 },
      ],
      3,
    );

    expect(result.allocations).toEqual([
      { batchNo: 'B1', expiryDate: null, quantity: 2 },
      { batchNo: 'B2', expiryDate: null, quantity: 1 },
    ]);
  });

  it('returns partial allocations when stock is insufficient', () => {
    const result = allocateStockFefo(
      [{ batchNo: null, expiryDate: null, quantity: 2 }],
      5,
    );

    expect(result.allocations).toEqual([
      { batchNo: null, expiryDate: null, quantity: 2 },
    ]);
    expect(result.availableQty).toBe(2);
  });
});
