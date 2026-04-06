import { SalesPaymentMethod } from '@prisma/client';

export interface FinalizePosCartPaymentInput {
  tenantId: string;
  cartSessionId: string;
  paymentMethod: SalesPaymentMethod;
  amountApplied?: number;
  amountTendered?: number | null;
  paymentReference?: string | null;
  notes?: string | null;
  createdBy?: string | null;
}
