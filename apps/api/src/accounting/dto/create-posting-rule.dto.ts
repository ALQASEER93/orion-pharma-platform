import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePostingRuleDto {
  @IsUUID()
  ruleSetId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  eventType!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priority?: number;

  @IsString()
  @IsNotEmpty()
  debitAccountCode!: string;

  @IsString()
  @IsNotEmpty()
  creditAccountCode!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  amountExpr!: string;

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
