import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaxonomyItemDto } from './dto/create-taxonomy-item.dto';

type TaxonomyType =
  | 'therapeutic_classes'
  | 'dosage_forms'
  | 'storage_conditions'
  | 'regulatory_types';

@Injectable()
export class TaxonomyService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, type: TaxonomyType) {
    switch (type) {
      case 'therapeutic_classes':
        return this.prisma.therapeuticClass.findMany({
          where: { tenantId },
          orderBy: { nameEn: 'asc' },
        });
      case 'dosage_forms':
        return this.prisma.dosageForm.findMany({
          where: { tenantId },
          orderBy: { nameEn: 'asc' },
        });
      case 'storage_conditions':
        return this.prisma.storageCondition.findMany({
          where: { tenantId },
          orderBy: { nameEn: 'asc' },
        });
      case 'regulatory_types':
        return this.prisma.regulatoryType.findMany({
          where: { tenantId },
          orderBy: { nameEn: 'asc' },
        });
    }
  }

  create(tenantId: string, dto: CreateTaxonomyItemDto) {
    switch (dto.type) {
      case 'therapeutic_classes':
        return this.prisma.therapeuticClass.create({
          data: { tenantId, nameAr: dto.nameAr, nameEn: dto.nameEn },
        });
      case 'dosage_forms':
        return this.prisma.dosageForm.create({
          data: { tenantId, nameAr: dto.nameAr, nameEn: dto.nameEn },
        });
      case 'storage_conditions':
        return this.prisma.storageCondition.create({
          data: { tenantId, nameAr: dto.nameAr, nameEn: dto.nameEn },
        });
      case 'regulatory_types':
        return this.prisma.regulatoryType.create({
          data: { tenantId, nameAr: dto.nameAr, nameEn: dto.nameEn },
        });
    }
  }
}
