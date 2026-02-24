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

export class CreateGoodsReceiptLineDto {
  @IsUUID()
  purchaseOrderLineId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  qtyReceivedNow!: number;

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

export class CreateGoodsReceiptDto {
  @IsUUID()
  purchaseOrderId!: string;

  @IsString()
  @MaxLength(120)
  idempotencyKey!: string;

  @IsOptional()
  @IsDateString()
  receivedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateGoodsReceiptLineDto)
  lines!: CreateGoodsReceiptLineDto[];
}
