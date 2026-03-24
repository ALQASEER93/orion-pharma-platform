import { TrackingMode } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ProductWorkspaceConcurrencyDto } from './product-workspace-concurrency.dto';

export class UpdateProductWorkspaceDraftDto extends ProductWorkspaceConcurrencyDto {
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
}
