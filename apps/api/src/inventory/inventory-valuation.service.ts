import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  applyInMovement,
  applyOutMovement,
  roundMoney,
} from './valuation-math';

type ValuationTx = Pick<
  Prisma.TransactionClient,
  'inventoryValuationApplied' | 'inventoryValuationState' | 'salesInvoiceLine'
>;

@Injectable()
export class InventoryValuationService {
  async getCurrentAvgUnitCost(
    tx: Pick<Prisma.TransactionClient, 'inventoryValuationState'>,
    tenantId: string,
    branchId: string,
    productId: string,
  ): Promise<number> {
    const state = await tx.inventoryValuationState.findUnique({
      where: {
        tenantId_branchId_productId: {
          tenantId,
          branchId,
          productId,
        },
      },
      select: {
        avgUnitCost: true,
      },
    });

    return roundMoney(state?.avgUnitCost ?? 0);
  }

  async applyMovement(
    tx: ValuationTx,
    args: {
      tenantId: string;
      inventoryMovementId: string;
      branchId: string;
      productId: string;
      quantityDelta: number;
      unitCost?: number | null;
      salesInvoiceLineId?: string | null;
      writeSnapshot?: boolean;
    },
  ): Promise<{ applied: boolean; effectiveUnitCost: number }> {
    try {
      await tx.inventoryValuationApplied.create({
        data: {
          tenantId: args.tenantId,
          inventoryMovementId: args.inventoryMovementId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return {
          applied: false,
          effectiveUnitCost: roundMoney(args.unitCost ?? 0),
        };
      }

      throw error;
    }

    const state = await tx.inventoryValuationState.upsert({
      where: {
        tenantId_branchId_productId: {
          tenantId: args.tenantId,
          branchId: args.branchId,
          productId: args.productId,
        },
      },
      update: {},
      create: {
        tenantId: args.tenantId,
        branchId: args.branchId,
        productId: args.productId,
        qtyOnHand: 0,
        avgUnitCost: 0,
        inventoryValue: 0,
      },
    });

    const quantity = args.quantityDelta;
    if (quantity === 0) {
      return {
        applied: true,
        effectiveUnitCost: roundMoney(args.unitCost ?? 0),
      };
    }

    const oldState = {
      qtyOnHand: state.qtyOnHand,
      avgUnitCost: state.avgUnitCost,
      inventoryValue: state.inventoryValue,
    };

    if (quantity > 0) {
      const inUnitCost = roundMoney(args.unitCost ?? oldState.avgUnitCost ?? 0);
      const next = applyInMovement(oldState, quantity, inUnitCost);
      await tx.inventoryValuationState.update({
        where: { id: state.id },
        data: next,
      });
      return { applied: true, effectiveUnitCost: inUnitCost };
    }

    const outQty = Math.abs(quantity);
    const outUnitCost = roundMoney(args.unitCost ?? oldState.avgUnitCost ?? 0);

    if (oldState.qtyOnHand + 0.000001 < outQty) {
      throw new ConflictException(
        'Inventory valuation state has insufficient quantity for OUT movement.',
      );
    }

    const next = applyOutMovement(oldState, outQty, outUnitCost);
    await tx.inventoryValuationState.update({
      where: { id: state.id },
      data: next,
    });

    if (args.writeSnapshot && args.salesInvoiceLineId) {
      await tx.salesInvoiceLine.update({
        where: {
          id: args.salesInvoiceLineId,
        },
        data: {
          unitCostSnapshot: outUnitCost,
          costMethodSnapshot: 'MOVING_AVG',
        },
      });
    }

    return { applied: true, effectiveUnitCost: outUnitCost };
  }
}
