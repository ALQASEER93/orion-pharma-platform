import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReopenPeriodDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
