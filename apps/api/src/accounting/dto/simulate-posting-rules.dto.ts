import {
  IsDateString,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class SimulatePostingRulesDto {
  @IsString()
  eventType!: string;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsOptional()
  @IsDateString()
  effectiveAt?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}
