import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class QueryPurchaseReturnsDto {
  @IsOptional()
  @IsUUID()
  goodsReceiptId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsDateString()
  returnedFrom?: string;

  @IsOptional()
  @IsDateString()
  returnedTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}
