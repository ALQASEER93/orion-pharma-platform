export type StockLotCandidate = {
  batchNo: string | null;
  expiryDate: Date | null;
  quantity: number;
};

export type StockAllocation = {
  batchNo: string | null;
  expiryDate: Date | null;
  quantity: number;
};

export function allocateStockFefo(
  candidates: StockLotCandidate[],
  requiredQty: number,
): { allocations: StockAllocation[]; availableQty: number } {
  const sorted = [...candidates]
    .filter((item) => item.quantity > 0)
    .sort((a, b) => {
      const aExpiry = a.expiryDate?.getTime();
      const bExpiry = b.expiryDate?.getTime();

      if (
        aExpiry !== undefined &&
        bExpiry !== undefined &&
        aExpiry !== bExpiry
      ) {
        return aExpiry - bExpiry;
      }

      if (aExpiry !== undefined && bExpiry === undefined) {
        return -1;
      }

      if (aExpiry === undefined && bExpiry !== undefined) {
        return 1;
      }

      const aBatch = a.batchNo ?? '';
      const bBatch = b.batchNo ?? '';
      return aBatch.localeCompare(bBatch);
    });

  const allocations: StockAllocation[] = [];
  let remaining = requiredQty;

  for (const candidate of sorted) {
    if (remaining <= 0) {
      break;
    }

    const consume = Math.min(candidate.quantity, remaining);
    if (consume <= 0) {
      continue;
    }

    allocations.push({
      batchNo: candidate.batchNo,
      expiryDate: candidate.expiryDate,
      quantity: consume,
    });

    remaining -= consume;
  }

  const availableQty = sorted.reduce((sum, item) => sum + item.quantity, 0);

  return {
    allocations,
    availableQty,
  };
}
