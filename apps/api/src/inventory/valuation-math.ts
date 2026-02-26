const EPSILON = 0.000001;

export type ValuationStateInput = {
  qtyOnHand: number;
  avgUnitCost: number;
  inventoryValue: number;
};

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function applyInMovement(
  state: ValuationStateInput,
  inQty: number,
  inUnitCost: number,
) {
  const oldQty = Math.max(0, state.qtyOnHand);
  const oldValue = Math.max(0, state.inventoryValue);
  const lineValue = roundMoney(inQty * inUnitCost);
  const newQty = oldQty + inQty;
  const newValue = roundMoney(oldValue + lineValue);
  const newAvg = newQty > EPSILON ? roundMoney(newValue / newQty) : 0;

  return {
    qtyOnHand: roundMoney(newQty),
    inventoryValue: newValue,
    avgUnitCost: newAvg,
  };
}

export function applyOutMovement(
  state: ValuationStateInput,
  outQty: number,
  unitCost: number,
) {
  const oldQty = Math.max(0, state.qtyOnHand);
  const oldValue = Math.max(0, state.inventoryValue);
  const movementValue = roundMoney(outQty * unitCost);
  const rawQty = oldQty - outQty;
  const rawValue = roundMoney(oldValue - movementValue);

  if (rawQty <= EPSILON) {
    return {
      qtyOnHand: 0,
      inventoryValue: 0,
      avgUnitCost: 0,
    };
  }

  return {
    qtyOnHand: roundMoney(rawQty),
    inventoryValue: rawValue < 0 ? 0 : rawValue,
    avgUnitCost: roundMoney(state.avgUnitCost),
  };
}
