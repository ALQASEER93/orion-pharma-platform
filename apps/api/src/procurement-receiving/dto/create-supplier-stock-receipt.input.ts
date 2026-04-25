export interface CreateSupplierStockReceiptLineInput {
  lineNo?: number;
  productPackId: string;
  lotBatchId: string;
  quantityReceived: number;
  unitCost?: number | null;
  lineTotal?: number | null;
  notes?: string | null;
}

export interface CreateSupplierStockReceiptInput {
  tenantId: string;
  legalEntityId?: string | null;
  branchId: string;
  supplierId: string;
  receiptNumber: string;
  notes?: string | null;
  receivedAt?: Date;
  createdBy?: string | null;
  lines: CreateSupplierStockReceiptLineInput[];
}
