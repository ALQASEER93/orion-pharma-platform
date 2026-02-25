import { Type } from 'class-transformer';
import { ArReceiptMethod } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateArReceiptDto {
  @IsUUID()
  customerId!: string;

  @IsDateString()
  date!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsEnum(ArReceiptMethod)
  method!: ArReceiptMethod;

  @IsOptional()
  @IsString()
  reference?: string;
}
