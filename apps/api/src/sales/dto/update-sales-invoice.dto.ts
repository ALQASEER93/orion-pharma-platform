import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdateSalesInvoiceDto {
  @IsOptional()
  @IsUUID()
  customerId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsDateString()
  issuedAt?: string;
}
