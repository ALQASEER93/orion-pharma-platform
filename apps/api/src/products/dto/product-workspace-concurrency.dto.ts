import { IsISO8601, IsOptional } from 'class-validator';

export class ProductWorkspaceConcurrencyDto {
  @IsOptional()
  @IsISO8601()
  expectedDraftUpdatedAt?: string;

  @IsOptional()
  @IsISO8601()
  expectedCatalogUpdatedAt?: string;

  @IsOptional()
  @IsISO8601()
  expectedBasedOnUpdatedAt?: string;
}
