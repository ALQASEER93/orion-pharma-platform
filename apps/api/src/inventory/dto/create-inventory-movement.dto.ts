import { InventoryMovementType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateInventoryMovementDto {
  @IsUUID()
  branchId!: string;

  @IsUUID()
  productId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  batchNo?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsEnum(InventoryMovementType)
  movementType!: InventoryMovementType;

  @IsInt()
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
