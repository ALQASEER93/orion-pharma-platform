import { MedicationAccessMode, TrackingMode } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class SaveProductMaintenanceDto {
  @IsUUID()
  branchId!: string;

  @IsString()
  @MaxLength(200)
  nameEn!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nameAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  tradeNameEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  tradeNameAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  genericNameEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  genericNameAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  categoryEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  categoryAr?: string;

  @IsString()
  @MaxLength(100)
  barcode!: string;

  @IsString()
  @MaxLength(100)
  strength!: string;

  @IsString()
  @MaxLength(100)
  packSize!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  unitOfMeasure?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  dosageFormName?: string;

  @IsOptional()
  @IsUUID()
  dosageFormId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  defaultSalePrice!: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  taxProfileCode?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(MedicationAccessMode)
  medicationAccessMode?: MedicationAccessMode;

  @IsOptional()
  @IsEnum(TrackingMode)
  trackingMode?: TrackingMode;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  packCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  packBarcode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  unitsPerPack?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  batchNo?: string;

  @IsOptional()
  @IsString()
  expiryDate?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  branchStockQuantity!: number;
}
