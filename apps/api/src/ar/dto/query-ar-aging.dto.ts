import { IsDateString } from 'class-validator';

export class QueryArAgingDto {
  @IsDateString()
  asOf!: string;
}
