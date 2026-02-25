import { Prisma } from '@prisma/client';
import { InventoryValuationService } from './inventory-valuation.service';

describe('InventoryValuationService', () => {
  it('is idempotent per movement id and skips second application', async () => {
    const service = new InventoryValuationService();

    const create = jest
      .fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('unique', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

    const update = jest.fn().mockResolvedValue({});
    const upsert = jest.fn().mockResolvedValue({
      id: 'state-1',
      qtyOnHand: 0,
      avgUnitCost: 0,
      inventoryValue: 0,
    });

    const tx = {
      inventoryValuationApplied: { create },
      inventoryValuationState: { upsert, update },
      salesInvoiceLine: { update: jest.fn() },
    } as unknown as {
      inventoryValuationApplied: { create: typeof create };
      inventoryValuationState: { upsert: typeof upsert; update: typeof update };
      salesInvoiceLine: { update: jest.Mock };
    };

    const first = await service.applyMovement(tx as never, {
      tenantId: 't1',
      inventoryMovementId: 'm1',
      branchId: 'b1',
      productId: 'p1',
      quantityDelta: 5,
      unitCost: 2,
    });
    expect(first.applied).toBe(true);
    expect(update).toHaveBeenCalledTimes(1);

    const second = await service.applyMovement(tx as never, {
      tenantId: 't1',
      inventoryMovementId: 'm1',
      branchId: 'b1',
      productId: 'p1',
      quantityDelta: 5,
      unitCost: 2,
    });
    expect(second.applied).toBe(false);
    expect(update).toHaveBeenCalledTimes(1);
  });
});
