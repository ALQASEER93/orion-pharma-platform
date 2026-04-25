import { ProductPackSellability, ProductPackStatus } from '@prisma/client';

export interface CreateProductPackInput {
  tenantId: string;
  productId: string;
  code: string;
  barcode?: string | null;
  unitsPerPack?: number;
  status?: ProductPackStatus;
  sellability?: ProductPackSellability;
  isDefault?: boolean;
}

