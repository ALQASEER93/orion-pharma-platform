import { TrackingMode } from '@prisma/client';
import {
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
