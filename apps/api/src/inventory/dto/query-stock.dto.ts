import { IsOptional, IsUUID } from 'class-validator';

export class QueryStockDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;
}
