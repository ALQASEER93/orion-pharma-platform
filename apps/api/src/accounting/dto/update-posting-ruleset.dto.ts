import { PostingRuleSetStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export class UpdatePostingRuleSetDto {
  @IsOptional()
  @IsEnum(PostingRuleSetStatus)
  status?: PostingRuleSetStatus;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
