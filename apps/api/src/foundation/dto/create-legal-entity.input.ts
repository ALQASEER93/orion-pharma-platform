export interface CreateLegalEntityInput {
  tenantId: string;
  code: string;
  nameAr: string;
  nameEn: string;
  registrationNumber?: string | null;
  taxNumber?: string | null;
  isActive?: boolean;
}

