import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdatePostingRuleDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  eventType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsString()
  debitAccountCode?: string;

  @IsOptional()
  @IsString()
  creditAccountCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  amountExpr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  memoTemplate?: string;

  @IsOptional()
  @IsObject()
  conditionsJson?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
