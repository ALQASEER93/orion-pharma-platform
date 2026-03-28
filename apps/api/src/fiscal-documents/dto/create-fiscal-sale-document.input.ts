export interface CreateFiscalSaleDocumentLineInput {
  lineNo?: number;
  productPackId: string;
  lotBatchId?: string | null;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number | null;
  lineTotal?: number;
  referenceKey?: string | null;
}

export interface CreateFiscalSaleDocumentInput {
  tenantId: string;
  legalEntityId?: string | null;
  branchId: string;
  registerId?: string | null;
  documentNo: string;
  currency?: string;
  subtotal?: number;
  discountTotal?: number;
  taxTotal?: number;
  grandTotal?: number;
  inventoryAnchorReferenceId?: string | null;
  createdByUserId?: string | null;
  lines: CreateFiscalSaleDocumentLineInput[];
}
