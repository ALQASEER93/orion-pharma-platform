import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateJournalLineDto {
  @IsUUID()
  accountId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  debit!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  credit!: number;

  @IsOptional()
  @IsString()
  memo?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class CreateJournalDto {
  @IsDateString()
  date!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  sourceType?: string;

  @IsOptional()
  @IsString()
  sourceId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateJournalLineDto)
  lines!: CreateJournalLineDto[];
}
