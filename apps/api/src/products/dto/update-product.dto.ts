import { MedicationAccessMode, TrackingMode } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nameAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nameEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  tradeNameAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  tradeNameEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  genericNameAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  genericNameEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  categoryAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  categoryEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  barcode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  strength?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  packSize?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  unitOfMeasure?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  taxProfileCode?: string;

  @IsOptional()
  @IsEnum(MedicationAccessMode)
  medicationAccessMode?: MedicationAccessMode;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(TrackingMode)
  trackingMode?: TrackingMode;

  @IsOptional()
  @IsUUID()
  therapeuticClassId?: string;

  @IsOptional()
  @IsUUID()
  dosageFormId?: string;

  @IsOptional()
  @IsUUID()
  storageConditionId?: string;

  @IsOptional()
  @IsUUID()
  regulatoryTypeId?: string;
}
