import { Transform } from 'class-transformer';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class RunReconciliationDto {
  @IsOptional()
  @Transform(({ value, obj }) => value ?? obj.as_of_date)
  @IsDateString()
  asOf?: string;

  @IsOptional()
  @IsUUID()
  periodId?: string;
}
