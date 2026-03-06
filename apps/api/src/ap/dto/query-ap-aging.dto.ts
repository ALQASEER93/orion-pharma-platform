import { Transform } from 'class-transformer';
import { IsDateString } from 'class-validator';

export class QueryApAgingDto {
  @Transform(({ value, obj }) => value ?? obj.as_of_date)
  @IsDateString()
  asOf!: string;
}
