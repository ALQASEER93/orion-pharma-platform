export interface CreateFiscalReturnDocumentLineInput {
  lineNo?: number;
  sourceSaleLineId?: string | null;
  productPackId: string;
  lotBatchId?: string | null;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number | null;
  lineTotal?: number;
  reasonCode?: string | null;
}

export interface CreateFiscalReturnDocumentInput {
  tenantId: string;
  legalEntityId?: string | null;
  branchId: string;
  registerId?: string | null;
  sourceSaleDocumentId?: string | null;
  documentNo: string;
  currency?: string;
  subtotal?: number;
  discountTotal?: number;
  taxTotal?: number;
  grandTotal?: number;
  inventoryAnchorReferenceId?: string | null;
  createdByUserId?: string | null;
  lines: CreateFiscalReturnDocumentLineInput[];
}
