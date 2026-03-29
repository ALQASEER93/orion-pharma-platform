import { SalesPaymentMethod } from '@prisma/client';

export interface FinalizePosReturnInput {
  tenantId: string;
  returnSessionId: string;
  refundMethod: SalesPaymentMethod;
  refundAmount?: number;
  refundReference?: string | null;
  notes?: string | null;
  createdBy?: string | null;
}
