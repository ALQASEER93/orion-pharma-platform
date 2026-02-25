import { applyInMovement, applyOutMovement } from './valuation-math';

describe('valuation math', () => {
  it('calculates moving average across IN sequences', () => {
    const afterFirstIn = applyInMovement(
      {
        qtyOnHand: 0,
        avgUnitCost: 0,
        inventoryValue: 0,
      },
      10,
      5,
    );
    expect(afterFirstIn.qtyOnHand).toBe(10);
    expect(afterFirstIn.inventoryValue).toBe(50);
    expect(afterFirstIn.avgUnitCost).toBe(5);

    const afterSecondIn = applyInMovement(afterFirstIn, 5, 8);
    expect(afterSecondIn.qtyOnHand).toBe(15);
    expect(afterSecondIn.inventoryValue).toBe(90);
    expect(afterSecondIn.avgUnitCost).toBe(6);
  });

  it('reduces value correctly for OUT and resets when stock reaches zero', () => {
    const afterOut = applyOutMovement(
      {
        qtyOnHand: 15,
        avgUnitCost: 6,
        inventoryValue: 90,
      },
      4,
      6,
    );

    expect(afterOut.qtyOnHand).toBe(11);
    expect(afterOut.inventoryValue).toBe(66);
    expect(afterOut.avgUnitCost).toBe(6);

    const zeroed = applyOutMovement(afterOut, 11, 6);
    expect(zeroed.qtyOnHand).toBe(0);
    expect(zeroed.inventoryValue).toBe(0);
    expect(zeroed.avgUnitCost).toBe(0);
  });
});
