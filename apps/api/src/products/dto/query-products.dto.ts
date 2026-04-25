import { Type, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MedicationAccessMode, TrackingMode } from '@prisma/client';

export class QueryProductsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsEnum(TrackingMode)
  trackingMode?: TrackingMode;

  @IsOptional()
  @IsEnum(MedicationAccessMode)
  medicationAccessMode?: MedicationAccessMode;

  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  includeAvailability?: boolean;

  @IsOptional()
  @IsIn(['catalog', 'pos'])
  mode?: 'catalog' | 'pos';

  @IsOptional()
  @IsIn(['all', 'trade', 'generic', 'supplier', 'category', 'barcode'])
  searchMode?:
    | 'all'
    | 'trade'
    | 'generic'
    | 'supplier'
    | 'category'
    | 'barcode';
}
