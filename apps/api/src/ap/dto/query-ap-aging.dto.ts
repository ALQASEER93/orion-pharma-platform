import { IsDateString } from 'class-validator';

export class QueryApAgingDto {
  @IsDateString()
  asOf!: string;
}
