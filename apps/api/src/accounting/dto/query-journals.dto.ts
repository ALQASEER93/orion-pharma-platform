import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { JournalEntryStatus } from '@prisma/client';

export class QueryJournalsDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsEnum(JournalEntryStatus)
  status?: JournalEntryStatus;
}
