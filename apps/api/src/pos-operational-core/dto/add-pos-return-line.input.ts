export interface AddPosReturnLineInput {
  tenantId: string;
  returnSessionId: string;
  sourceSaleLineId?: string | null;
  lineNo?: number;
  productPackId: string;
  lotBatchId: string;
  quantityReturned: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number | null;
  lineTotal?: number;
  reasonCode?: string | null;
  notes?: string | null;
}
