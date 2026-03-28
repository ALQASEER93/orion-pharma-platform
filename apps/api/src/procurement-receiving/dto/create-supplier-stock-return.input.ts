export interface CreateSupplierStockReturnLineInput {
  lineNo?: number;
  sourceReceiptLineId?: string | null;
  productPackId: string;
  lotBatchId: string;
  quantityReturned: number;
  reasonCode?: string | null;
  notes?: string | null;
}

export interface CreateSupplierStockReturnInput {
  tenantId: string;
  legalEntityId?: string | null;
  branchId: string;
  supplierId: string;
  sourceReceiptId?: string | null;
  returnNumber: string;
  reasonCode?: string | null;
  notes?: string | null;
  returnedAt?: Date;
  createdBy?: string | null;
  lines: CreateSupplierStockReturnLineInput[];
}
