import { IsOptional, IsUUID } from 'class-validator';

export class ListReconciliationRunsDto {
  @IsOptional()
  @IsUUID()
  periodId?: string;
}
