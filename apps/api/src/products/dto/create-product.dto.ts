import { TrackingMode } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MaxLength(200)
  nameAr!: string;

  @IsString()
  @MaxLength(200)
  nameEn!: string;

  @IsString()
  @MaxLength(100)
  barcode!: string;

  @IsString()
  @MaxLength(100)
  strength!: string;

  @IsString()
  @MaxLength(100)
  packSize!: string;

  @IsEnum(TrackingMode)
  trackingMode!: TrackingMode;

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
