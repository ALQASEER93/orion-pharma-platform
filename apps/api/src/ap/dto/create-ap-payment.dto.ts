import { Type } from 'class-transformer';
import { ApPaymentMethod } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateApPaymentDto {
  @IsUUID()
  supplierId!: string;

  @IsDateString()
  date!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsEnum(ApPaymentMethod)
  method!: ApPaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reference?: string;
}
