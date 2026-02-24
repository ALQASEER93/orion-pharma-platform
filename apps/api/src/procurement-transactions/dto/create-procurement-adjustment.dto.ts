import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  NotEquals,
  ValidateNested,
} from 'class-validator';

export class CreateProcurementAdjustmentLineDto {
  @IsUUID()
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @NotEquals(0)
  quantityDelta!: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  reasonCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  batchNo?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  notes?: string;
}

export class CreateProcurementAdjustmentDto {
  @IsUUID()
  branchId!: string;

  @IsString()
  @MaxLength(80)
  reasonCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  sourceRefType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourceRefId?: string;

  @IsOptional()
  @IsDateString()
  adjustedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateProcurementAdjustmentLineDto)
  lines!: CreateProcurementAdjustmentLineDto[];
}
