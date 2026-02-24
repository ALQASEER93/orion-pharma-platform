import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class QueryGoodsReceiptsDto {
  @IsOptional()
  @IsUUID()
  purchaseOrderId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsDateString()
  receivedFrom?: string;

  @IsOptional()
  @IsDateString()
  receivedTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}
