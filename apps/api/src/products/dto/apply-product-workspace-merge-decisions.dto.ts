import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ProductWorkspaceConcurrencyDto } from './product-workspace-concurrency.dto';

export const productWorkspaceMergeFieldKeys = [
  'nameAr',
  'nameEn',
  'barcode',
  'strength',
  'packSize',
  'trackingMode',
] as const;

export type ProductWorkspaceMergeFieldKey =
  (typeof productWorkspaceMergeFieldKeys)[number];

export enum ProductWorkspaceMergeDecision {
  APPLY_DRAFT = 'APPLY_DRAFT',
  KEEP_REFERENCE = 'KEEP_REFERENCE',
}

export class ProductWorkspaceMergeDecisionItemDto {
  @IsIn(productWorkspaceMergeFieldKeys)
  fieldKey!: ProductWorkspaceMergeFieldKey;

  @IsEnum(ProductWorkspaceMergeDecision)
  decision!: ProductWorkspaceMergeDecision;
}

export class ApplyProductWorkspaceMergeDecisionsDto extends ProductWorkspaceConcurrencyDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ProductWorkspaceMergeDecisionItemDto)
  decisions!: ProductWorkspaceMergeDecisionItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  rationale?: string;
}
