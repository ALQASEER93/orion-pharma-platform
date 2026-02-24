import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateSalesInvoiceLineDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ValidateIf((value: CreateSalesInvoiceLineDto) => !value.productId)
  @IsString()
  @MaxLength(200)
  itemName?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  qty!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxRate?: number;
}
