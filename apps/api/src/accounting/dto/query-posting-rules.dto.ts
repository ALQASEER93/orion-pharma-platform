import { IsOptional, IsUUID } from 'class-validator';

export class QueryPostingRulesDto {
  @IsOptional()
  @IsUUID()
  ruleSetId?: string;
}
