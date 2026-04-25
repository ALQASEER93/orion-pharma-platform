import {
  InventoryLedgerEntryType,
  InventoryLedgerReferenceType,
  InventoryPostingSurface,
  InventoryStockBucket,
} from '@prisma/client';

export interface CreateInventoryLedgerEntryInput {
  tenantId: string;
  branchId: string;
  registerId?: string | null;
  productPackId: string;
  lotBatchId: string;
  entryType: InventoryLedgerEntryType;
  postingSurface?: InventoryPostingSurface;
  referenceType?: InventoryLedgerReferenceType;
  referenceId?: string | null;
  referenceLineId?: string | null;
  reasonCode?: string | null;
  stockBucket?: InventoryStockBucket;
  quantityDelta: number;
  unitCost?: number | null;
  amountTotal?: number | null;
  occurredAt?: Date;
  createdBy?: string | null;
}
