import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ProductWorkspaceConcurrencyDto } from './product-workspace-concurrency.dto';

export enum ProductWorkspaceApprovalDecision {
  SUBMIT_FOR_APPROVAL = 'SUBMIT_FOR_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  REQUEST_CHANGES = 'REQUEST_CHANGES',
}

export class ApplyProductWorkspaceApprovalDto extends ProductWorkspaceConcurrencyDto {
  @IsEnum(ProductWorkspaceApprovalDecision)
  decision!: ProductWorkspaceApprovalDecision;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
