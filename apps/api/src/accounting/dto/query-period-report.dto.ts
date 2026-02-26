import { IsUUID } from 'class-validator';

export class QueryPeriodReportDto {
  @IsUUID()
  periodId!: string;
}
