import { IsIn, IsString, MaxLength } from 'class-validator';

export class CreateTaxonomyItemDto {
  @IsIn([
    'therapeutic_classes',
    'dosage_forms',
    'storage_conditions',
    'regulatory_types',
  ])
  type!:
    | 'therapeutic_classes'
    | 'dosage_forms'
    | 'storage_conditions'
    | 'regulatory_types';

  @IsString()
  @MaxLength(200)
  nameAr!: string;

  @IsString()
  @MaxLength(200)
  nameEn!: string;
}
