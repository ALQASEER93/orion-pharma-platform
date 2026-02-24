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
  Min,
  ValidateNested,
} from 'class-validator';

export class CreatePurchaseReturnLineDto {
  @IsUUID()
  goodsReceiptLineId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  qtyReturnNow!: number;

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

export class CreatePurchaseReturnDto {
  @IsUUID()
  goodsReceiptId!: string;

  @IsString()
  @MaxLength(120)
  idempotencyKey!: string;

  @IsOptional()
  @IsDateString()
  returnedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseReturnLineDto)
  lines!: CreatePurchaseReturnLineDto[];
}
