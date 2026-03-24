import { ProductWorkspaceFilter } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ProductWorkspaceConcurrencyDto } from './product-workspace-concurrency.dto';

export class CreateProductWorkspaceWorklistDto extends ProductWorkspaceConcurrencyDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  query?: string;

  @IsEnum(ProductWorkspaceFilter)
  filter!: ProductWorkspaceFilter;

  @IsArray()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  selectedKeys!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  focusedKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  scopeSummary?: string;
}
