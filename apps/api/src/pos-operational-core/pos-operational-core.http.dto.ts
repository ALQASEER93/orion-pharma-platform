import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class PosOperationalCatalogQueryDto {
  @IsUUID()
  branchId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class PosOperationalContextQueryDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class PosOperationalFinalizedSalesQueryDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class PosOpenCartSessionsQueryDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  registerId?: string;
}

export class PosCreateCartSessionDto {
  @IsOptional()
  @IsUUID()
  legalEntityId?: string;

  @IsUUID()
  branchId!: string;

  @IsUUID()
  registerId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class PosAddCartLineDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  lineNo?: number;

  @IsUUID()
  productPackId!: string;

  @IsUUID()
  lotBatchId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxRate?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class PosUpdateCartLineDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxRate?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class PosFinalizeCashSaleDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amountApplied?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amountTendered?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  paymentReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class PosCreateReturnSessionDto {
  @IsOptional()
  @IsUUID()
  legalEntityId?: string;

  @IsUUID()
  branchId!: string;

  @IsUUID()
  registerId!: string;

  @IsOptional()
  @IsUUID()
  sourceSaleDocumentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reasonCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class PosAddReturnLineDto {
  @IsOptional()
  @IsUUID()
  sourceSaleLineId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  lineNo?: number;

  @IsUUID()
  productPackId!: string;

  @IsUUID()
  lotBatchId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantityReturned!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxRate?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reasonCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class PosFinalizeReturnDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  refundAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  refundReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class PosLoginDto {
  @IsString()
  @MinLength(5)
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
