import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ProductWorkspaceConcurrencyDto } from './product-workspace-concurrency.dto';
import { productWorkspaceMergeFieldKeys } from './apply-product-workspace-merge-decisions.dto';

export const productWorkspacePromotionFieldKeys = [
  ...productWorkspaceMergeFieldKeys,
] as const;

export type ProductWorkspacePromotionFieldKey =
  (typeof productWorkspacePromotionFieldKeys)[number];

export enum ProductWorkspacePromotionMode {
  PROMOTE_DRAFT = 'PROMOTE_DRAFT',
}

export enum ProductWorkspacePromotionSource {
  DRAFT = 'DRAFT',
  REFERENCE = 'REFERENCE',
}

export enum ProductWorkspacePromotionTargetState {
  PROMOTED_INACTIVE = 'PROMOTED_INACTIVE',
}

export class ProductWorkspacePromotionPlanItemDto {
  @IsIn(productWorkspacePromotionFieldKeys)
  fieldKey!: ProductWorkspacePromotionFieldKey;

  @IsEnum(ProductWorkspacePromotionSource)
  source!: ProductWorkspacePromotionSource;

  @IsString()
  @MaxLength(2000)
  value!: string;
}

export class ProductWorkspacePromotionPlanDto {
  @IsEnum(ProductWorkspacePromotionMode)
  mode!: ProductWorkspacePromotionMode;

  @IsEnum(ProductWorkspacePromotionTargetState)
  targetState!: ProductWorkspacePromotionTargetState;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ProductWorkspacePromotionPlanItemDto)
  items!: ProductWorkspacePromotionPlanItemDto[];
}

export class ProductWorkspacePromotionExecutionDto extends ProductWorkspaceConcurrencyDto {
  @IsOptional()
  @IsBoolean()
  confirmed?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProductWorkspacePromotionPlanDto)
  plan?: ProductWorkspacePromotionPlanDto;
}
