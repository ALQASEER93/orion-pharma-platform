export interface CreatePosCartSessionInput {
  tenantId: string;
  legalEntityId?: string | null;
  branchId: string;
  registerId: string;
  currency?: string;
  notes?: string | null;
  createdBy?: string | null;
}
