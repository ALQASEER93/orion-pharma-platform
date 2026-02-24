import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  code?: string;

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
  @MaxLength(200)
  contactName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  preferredPaymentTerm?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
