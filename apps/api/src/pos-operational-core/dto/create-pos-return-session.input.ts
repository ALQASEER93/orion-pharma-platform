export interface CreatePosReturnSessionInput {
  tenantId: string;
  legalEntityId?: string | null;
  branchId: string;
  registerId: string;
  sourceSaleDocumentId?: string | null;
  reasonCode?: string | null;
  currency?: string;
  notes?: string | null;
  createdBy?: string | null;
}
