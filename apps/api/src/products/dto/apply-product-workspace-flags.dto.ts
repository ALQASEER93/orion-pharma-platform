import { IsArray, IsEnum, IsString, MaxLength } from 'class-validator';
import { ProductWorkspaceConcurrencyDto } from './product-workspace-concurrency.dto';

export enum ProductWorkspaceFlagAction {
  QUEUE = 'QUEUE',
  PRIORITIZE = 'PRIORITIZE',
  MARK_REVIEWED = 'MARK_REVIEWED',
  CLEAR = 'CLEAR',
}

export class ApplyProductWorkspaceFlagsDto extends ProductWorkspaceConcurrencyDto {
  @IsEnum(ProductWorkspaceFlagAction)
  action!: ProductWorkspaceFlagAction;

  @IsArray()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  recordKeys!: string[];
}
