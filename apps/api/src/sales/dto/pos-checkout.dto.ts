import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { SalesPaymentMethod } from '@prisma/client';

export class PosCheckoutLineDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
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

export class PosCheckoutPaymentDto {
  @IsEnum(SalesPaymentMethod)
  method!: SalesPaymentMethod;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;
}

export class PosCheckoutDto {
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PosCheckoutLineDto)
  lines!: PosCheckoutLineDto[];

  @ValidateNested()
  @Type(() => PosCheckoutPaymentDto)
  payment!: PosCheckoutPaymentDto;
}
