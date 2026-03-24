import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ProductWorkspaceConcurrencyDto } from './product-workspace-concurrency.dto';

export enum ProductWorkspaceHandoffExpectedDecision {
  REVIEW_MERGE_DECISIONS = 'REVIEW_MERGE_DECISIONS',
  APPROVE_MERGE = 'APPROVE_MERGE',
  APPLY_CHANGES = 'APPLY_CHANGES',
  PROMOTE_DRAFT = 'PROMOTE_DRAFT',
  NONE = 'NONE',
}

export class CreateProductWorkspaceHandoffDto extends ProductWorkspaceConcurrencyDto {
  @IsOptional()
  @IsEnum(ProductWorkspaceHandoffExpectedDecision)
  expectedDecision?: ProductWorkspaceHandoffExpectedDecision;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
