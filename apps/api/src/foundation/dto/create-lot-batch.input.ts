import { LotBatchStatus } from '@prisma/client';

export interface CreateLotBatchInput {
  tenantId: string;
  productPackId: string;
  batchNo: string;
  expiryDate?: Date | null;
  receivedOn?: Date;
  status?: LotBatchStatus;
  isSellable?: boolean;
  quarantinedAt?: Date | null;
  quarantineReason?: string | null;
}
