import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ClosePeriodDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
