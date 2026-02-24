import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class QuerySuppliersDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined ? undefined : value === 'true' || value === true,
  )
  @IsBoolean()
  isActive?: boolean;
}
