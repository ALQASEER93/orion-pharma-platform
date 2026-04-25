export interface AddPosCartLineInput {
  tenantId: string;
  cartSessionId: string;
  lineNo?: number;
  productPackId: string;
  lotBatchId: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number | null;
  lineTotal?: number;
  notes?: string | null;
}
