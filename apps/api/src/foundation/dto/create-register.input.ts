export interface CreateRegisterInput {
  tenantId: string;
  legalEntityId: string;
  branchId: string;
  code: string;
  nameAr: string;
  nameEn: string;
  isActive?: boolean;
}

