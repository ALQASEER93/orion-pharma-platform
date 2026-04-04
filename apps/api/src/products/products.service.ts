import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TrackingMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { SaveProductMaintenanceDto } from './dto/save-product-maintenance.dto';
import { UpdateProductDto } from './dto/update-product.dto';

type WorkspaceClient = PrismaService | Prisma.TransactionClient;

type ProductListRecord = Prisma.ProductGetPayload<{
  include: {
    therapeuticClass: true;
    dosageForm: true;
    storageCondition: true;
    regulatoryType: true;
    supplier: true;
  };
}>;

type RuntimeAvailability = {
  quantityOnHand: number;
  batchCount: number;
  branchIds: Set<string>;
};

type RuntimeAnchor = {
  branchId: string;
  productPackId: string;
  lotBatchId: string;
  packCode: string;
  packBarcode: string | null;
  packStatus: string;
  packSellability: string;
  unitsPerPack: number;
  batchNo: string;
  expiryDate: Date | null;
  lotStatus: string;
  isSellable: boolean;
  onHandQuantity: number;
  sellableQuantity: number;
  isDefaultPack: boolean;
};

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, query: QueryProductsDto) {
    const normalized = query.q?.trim().toLowerCase();
    const records = await this.prisma.product.findMany({
      where: this.buildWhere(tenantId, query),
      take: query.limit ?? 50,
      orderBy: [{ nameEn: 'asc' }, { barcode: 'asc' }],
      include: {
        therapeuticClass: true,
        dosageForm: true,
        storageCondition: true,
        regulatoryType: true,
        supplier: true,
      },
    });

    const sorted = normalized
      ? [...records].sort((left, right) => {
          const rankDelta =
            this.getSearchRank(left, normalized) -
            this.getSearchRank(right, normalized);
          if (rankDelta !== 0) {
            return rankDelta;
          }
          return `${left.nameEn}:${left.barcode}`.localeCompare(
            `${right.nameEn}:${right.barcode}`,
          );
        })
      : records;

    const needsRuntime = Boolean(
      query.includeAvailability || query.branchId || query.mode === 'pos',
    );
    if (!needsRuntime) {
      return sorted.map((record) =>
        this.mapListRecord(record, undefined, undefined, normalized, query.q),
      );
    }

    const runtime = await this.loadRuntimeAvailability(
      this.prisma,
      tenantId,
      sorted.map((record) => record.id),
      query.branchId ?? null,
    );

    return sorted.map((record) =>
      this.mapListRecord(
        record,
        runtime.availabilityByProduct.get(record.id),
        runtime.defaultRuntimeByProduct.get(record.id),
        normalized,
        query.q,
        query.branchId ?? null,
      ),
    );
  }

  async create(tenantId: string, dto: CreateProductDto) {
    try {
      return await this.prisma.product.create({
        data: {
          tenantId,
          nameAr: dto.nameAr,
          nameEn: dto.nameEn,
          tradeNameAr: dto.tradeNameAr,
          tradeNameEn: dto.tradeNameEn,
          genericNameAr: dto.genericNameAr,
          genericNameEn: dto.genericNameEn,
          categoryAr: dto.categoryAr,
          categoryEn: dto.categoryEn,
          barcode: dto.barcode,
          strength: dto.strength,
          packSize: dto.packSize,
          unitOfMeasure: dto.unitOfMeasure,
          defaultSalePrice: dto.defaultSalePrice,
          taxProfileCode: dto.taxProfileCode,
          medicationAccessMode: dto.medicationAccessMode,
          isActive: dto.isActive ?? true,
          trackingMode: dto.trackingMode ?? TrackingMode.NONE,
          therapeuticClassId: dto.therapeuticClassId,
          dosageFormId: dto.dosageFormId,
          storageConditionId: dto.storageConditionId,
          regulatoryTypeId: dto.regulatoryTypeId,
          supplierId: dto.supplierId,
        },
      });
    } catch (error) {
      this.rethrowUniqueConflict(error, 'Product barcode already exists in tenant.');
      throw error;
    }
  }

  async update(tenantId: string, productId: string, dto: UpdateProductDto) {
    await this.assertProductExists(this.prisma, tenantId, productId);

    try {
      return await this.prisma.product.update({
        where: { id: productId },
        data: {
          ...dto,
        },
      });
    } catch (error) {
      this.rethrowUniqueConflict(error, 'Product barcode already exists in tenant.');
      throw error;
    }
  }

  async saveMaintenanceRecord(
    tenantId: string,
    dto: SaveProductMaintenanceDto,
    createdBy: string | null,
    productId?: string,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const branch = await tx.branch.findFirst({
          where: { id: dto.branchId, tenantId },
          select: { id: true, legalEntityId: true },
        });
        if (!branch) {
          throw new NotFoundException('Branch not found in tenant.');
        }

        if (dto.supplierId) {
          const supplier = await tx.supplier.findFirst({
            where: { id: dto.supplierId, tenantId },
            select: { id: true },
          });
          if (!supplier) {
            throw new NotFoundException('Supplier not found in tenant.');
          }
        }

        const dosageFormId = await this.resolveDosageFormId(
          tx,
          tenantId,
          dto.dosageFormId,
          dto.dosageFormName,
        );

        const normalizedNameEn = dto.nameEn.trim();
        const normalizedNameAr = this.normalizeOptional(dto.nameAr) ?? normalizedNameEn;
        const normalizedTradeNameEn =
          this.normalizeOptional(dto.tradeNameEn) ?? normalizedNameEn;
        const normalizedTradeNameAr =
          this.normalizeOptional(dto.tradeNameAr) ?? normalizedNameAr;

        const productData = {
          nameEn: normalizedNameEn,
          nameAr: normalizedNameAr,
          tradeNameEn: normalizedTradeNameEn,
          tradeNameAr: normalizedTradeNameAr,
          genericNameEn: this.normalizeOptional(dto.genericNameEn),
          genericNameAr: this.normalizeOptional(dto.genericNameAr),
          categoryEn: this.normalizeOptional(dto.categoryEn),
          categoryAr: this.normalizeOptional(dto.categoryAr),
          barcode: dto.barcode.trim(),
          strength: dto.strength.trim(),
          packSize: dto.packSize.trim(),
          unitOfMeasure: this.normalizeOptional(dto.unitOfMeasure),
          defaultSalePrice: this.roundMoney(dto.defaultSalePrice),
          taxProfileCode: this.normalizeOptional(dto.taxProfileCode),
          medicationAccessMode: dto.medicationAccessMode ?? 'UNSPECIFIED',
          isActive: dto.isActive ?? true,
          trackingMode: dto.trackingMode ?? TrackingMode.LOT_EXPIRY,
          dosageFormId,
          supplierId: dto.supplierId ?? null,
        };

        if (productId) {
          await this.assertProductExists(tx, tenantId, productId);
        }

        const product = productId
          ? await tx.product.update({
              where: { id: productId },
              data: productData,
            })
          : await tx.product.create({
              data: {
                tenantId,
                ...productData,
              },
            });

        const packCode =
          this.normalizeOptional(dto.packCode) ??
          this.buildPackCode(product.barcode, product.nameEn);
        const packBarcode =
          this.normalizeOptional(dto.packBarcode) ?? product.barcode;
        const existingPack = await tx.productPack.findFirst({
          where: { tenantId, productId: product.id },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        });

        const pack = existingPack
          ? await tx.productPack.update({
              where: { id: existingPack.id },
              data: {
                code: packCode,
                barcode: packBarcode,
                unitsPerPack: dto.unitsPerPack ?? 1,
                status: 'ACTIVE',
                sellability: 'READY',
                isDefault: true,
              },
            })
          : await tx.productPack.create({
              data: {
                tenantId,
                productId: product.id,
                code: packCode,
                barcode: packBarcode,
                unitsPerPack: dto.unitsPerPack ?? 1,
                status: 'ACTIVE',
                sellability: 'READY',
                isDefault: true,
              },
            });

        await tx.productPack.updateMany({
          where: {
            tenantId,
            productId: product.id,
            id: { not: pack.id },
          },
          data: { isDefault: false },
        });

        const batchNo =
          this.normalizeOptional(dto.batchNo) ??
          this.buildBatchNo(product.barcode, product.nameEn);
        const expiryDate = this.resolveOptionalDate(dto.expiryDate);
        const existingLot = await tx.lotBatch.findFirst({
          where: { tenantId, productPackId: pack.id },
          orderBy: [{ createdAt: 'asc' }],
        });

        const lotBatch = existingLot
          ? await tx.lotBatch.update({
              where: { id: existingLot.id },
              data: {
                batchNo,
                expiryDate,
                status: 'SELLABLE',
                isSellable: true,
              },
            })
          : await tx.lotBatch.create({
              data: {
                tenantId,
                productPackId: pack.id,
                batchNo,
                expiryDate,
                status: 'SELLABLE',
                isSellable: true,
              },
            });

        const priorBalance = await tx.inventoryLotBalance.findUnique({
          where: {
            tenantId_branchId_productPackId_lotBatchId: {
              tenantId,
              branchId: dto.branchId,
              productPackId: pack.id,
              lotBatchId: lotBatch.id,
            },
          },
        });

        await tx.inventoryLotBalance.upsert({
          where: {
            tenantId_branchId_productPackId_lotBatchId: {
              tenantId,
              branchId: dto.branchId,
              productPackId: pack.id,
              lotBatchId: lotBatch.id,
            },
          },
          update: {
            onHandQuantity: dto.branchStockQuantity,
            sellableQuantity: dto.branchStockQuantity,
            quarantinedQuantity: 0,
            expiredQuantity: 0,
          },
          create: {
            tenantId,
            branchId: dto.branchId,
            productPackId: pack.id,
            lotBatchId: lotBatch.id,
            onHandQuantity: dto.branchStockQuantity,
            sellableQuantity: dto.branchStockQuantity,
            quarantinedQuantity: 0,
            expiredQuantity: 0,
          },
        });

        const quantityDelta =
          dto.branchStockQuantity - (priorBalance?.sellableQuantity ?? 0);
        const ledgerEntry =
          quantityDelta === 0
            ? null
            : await tx.inventoryLedgerEntry.create({
                data: {
                  tenantId,
                  legalEntityId: branch.legalEntityId,
                  branchId: branch.id,
                  registerId: null,
                  productPackId: pack.id,
                  lotBatchId: lotBatch.id,
                  entryType: 'ADJUSTMENT',
                  postingSurface: 'BRANCH',
                  referenceType: 'MANUAL_ADJUSTMENT',
                  referenceId: product.id,
                  referenceLineId: lotBatch.id,
                  reasonCode: 'PRODUCT_MAINTENANCE_SAVE',
                  stockBucket: 'SELLABLE',
                  quantityDelta,
                  unitCost: null,
                  amountTotal:
                    dto.defaultSalePrice > 0
                      ? this.roundMoney(
                          Math.abs(quantityDelta) * dto.defaultSalePrice,
                        )
                      : null,
                  createdBy,
                },
              });

        const savedRecord = await tx.product.findUniqueOrThrow({
          where: { id: product.id },
          include: {
            therapeuticClass: true,
            dosageForm: true,
            storageCondition: true,
            regulatoryType: true,
            supplier: true,
          },
        });

        const runtime = await this.loadRuntimeAvailability(
          tx,
          tenantId,
          [product.id],
          dto.branchId,
        );

        return {
          product: this.mapListRecord(
            savedRecord,
            runtime.availabilityByProduct.get(product.id),
            runtime.defaultRuntimeByProduct.get(product.id),
          ),
          persisted: {
            mutation: productId ? 'UPDATED' : 'CREATED',
            branchId: dto.branchId,
            productId: product.id,
            productPackId: pack.id,
            lotBatchId: lotBatch.id,
            inventoryLedgerEntryId: ledgerEntry?.id ?? null,
            branchStockQuantity: dto.branchStockQuantity,
          },
        };
      });
    } catch (error) {
      this.rethrowUniqueConflict(
        error,
        'A saved product, pack, lot, or barcode value already exists in tenant scope.',
      );
      throw error;
    }
  }

  private buildWhere(tenantId: string, query: QueryProductsDto): Prisma.ProductWhereInput {
    const search = query.q?.trim();
    const searchMode = query.searchMode ?? 'all';

    return {
      tenantId,
      ...(query.trackingMode ? { trackingMode: query.trackingMode } : {}),
      ...(query.medicationAccessMode
        ? { medicationAccessMode: query.medicationAccessMode }
        : {}),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(search
        ? {
            OR: this.buildSearchClauses(search, searchMode),
          }
        : {}),
    };
  }

  private buildSearchClauses(
    search: string,
    searchMode: NonNullable<QueryProductsDto['searchMode']>,
  ): Prisma.ProductWhereInput[] {
    const tradeClauses: Prisma.ProductWhereInput[] = [
      { tradeNameEn: { contains: search } },
      { tradeNameAr: { contains: search } },
      { nameEn: { contains: search } },
      { nameAr: { contains: search } },
    ];
    const genericClauses: Prisma.ProductWhereInput[] = [
      { genericNameEn: { contains: search } },
      { genericNameAr: { contains: search } },
      { nameEn: { contains: search } },
      { nameAr: { contains: search } },
    ];
    const supplierClauses: Prisma.ProductWhereInput[] = [
      { supplier: { is: { nameEn: { contains: search } } } },
      { supplier: { is: { nameAr: { contains: search } } } },
      { supplier: { is: { code: { contains: search } } } },
    ];
    const categoryClauses: Prisma.ProductWhereInput[] = [
      { categoryEn: { contains: search } },
      { categoryAr: { contains: search } },
      { dosageForm: { is: { nameEn: { contains: search } } } },
      { dosageForm: { is: { nameAr: { contains: search } } } },
    ];
    const barcodeClauses: Prisma.ProductWhereInput[] = [
      { barcode: { contains: search } },
    ];
    const allClauses: Prisma.ProductWhereInput[] = [
      ...tradeClauses,
      ...genericClauses,
      ...supplierClauses,
      ...categoryClauses,
      ...barcodeClauses,
      { taxProfileCode: { contains: search } },
      { packSize: { contains: search } },
      { strength: { contains: search } },
    ];

    switch (searchMode) {
      case 'trade':
        return [...tradeClauses, ...barcodeClauses];
      case 'generic':
        return genericClauses;
      case 'supplier':
        return supplierClauses;
      case 'category':
        return categoryClauses;
      case 'barcode':
        return barcodeClauses;
      default:
        return allClauses;
    }
  }

  private mapListRecord(
    record: ProductListRecord,
    availability?: RuntimeAvailability,
    runtime?: RuntimeAnchor,
    normalized?: string,
    query?: string,
    branchId?: string | null,
  ) {
    return {
      ...record,
      supplier: record.supplier
        ? {
            id: record.supplier.id,
            code: record.supplier.code,
            nameEn: record.supplier.nameEn,
            nameAr: record.supplier.nameAr,
            isActive: record.supplier.isActive,
          }
        : null,
      defaultSalePrice: record.defaultSalePrice ?? null,
      ...(normalized
        ? {
            search: {
              query: query,
              exactBarcodeMatch: record.barcode.toLowerCase() === normalized,
              matchedFields: this.resolveMatchedFields(record, normalized),
            },
          }
        : {}),
      ...(availability
        ? {
            availability: {
              branchScope: branchId ? 'SINGLE_BRANCH' : 'TENANT',
              branchId: branchId ?? null,
              quantityOnHand: availability.quantityOnHand,
              batchCount: availability.batchCount,
              branchesWithStock: availability.branchIds.size,
              status:
                availability.quantityOnHand > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
              isAvailable: availability.quantityOnHand > 0,
            },
          }
        : {}),
      ...(runtime
        ? {
            runtime: {
              branchId: runtime.branchId,
              productPackId: runtime.productPackId,
              lotBatchId: runtime.lotBatchId,
              packCode: runtime.packCode,
              packBarcode: runtime.packBarcode,
              packStatus: runtime.packStatus,
              packSellability: runtime.packSellability,
              unitsPerPack: runtime.unitsPerPack,
              batchNo: runtime.batchNo,
              expiryDate: runtime.expiryDate,
              lotStatus: runtime.lotStatus,
              isSellable: runtime.isSellable,
              onHandQuantity: runtime.onHandQuantity,
              sellableQuantity: runtime.sellableQuantity,
            },
          }
        : {}),
    };
  }

  private async loadRuntimeAvailability(
    db: WorkspaceClient,
    tenantId: string,
    productIds: string[],
    branchId: string | null,
  ) {
    const availabilityByProduct = new Map<string, RuntimeAvailability>();
    const defaultRuntimeByProduct = new Map<string, RuntimeAnchor>();

    if (productIds.length === 0) {
      return { availabilityByProduct, defaultRuntimeByProduct };
    }

    const balances = await db.inventoryLotBalance.findMany({
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        productPack: {
          productId: { in: productIds },
        },
      },
      select: {
        branchId: true,
        onHandQuantity: true,
        sellableQuantity: true,
        productPack: {
          select: {
            id: true,
            productId: true,
            code: true,
            barcode: true,
            status: true,
            sellability: true,
            unitsPerPack: true,
            isDefault: true,
          },
        },
        lotBatch: {
          select: {
            id: true,
            batchNo: true,
            expiryDate: true,
            status: true,
            isSellable: true,
          },
        },
      },
    });

    for (const balance of balances) {
      const productId = balance.productPack.productId;
      const current = availabilityByProduct.get(productId) ?? {
        quantityOnHand: 0,
        batchCount: 0,
        branchIds: new Set<string>(),
      };
      current.quantityOnHand += balance.onHandQuantity;
      if (balance.onHandQuantity > 0) {
        current.batchCount += 1;
      }
      current.branchIds.add(balance.branchId);
      availabilityByProduct.set(productId, current);

      const candidate: RuntimeAnchor = {
        branchId: balance.branchId,
        productPackId: balance.productPack.id,
        lotBatchId: balance.lotBatch.id,
        packCode: balance.productPack.code,
        packBarcode: balance.productPack.barcode,
        packStatus: balance.productPack.status,
        packSellability: balance.productPack.sellability,
        unitsPerPack: balance.productPack.unitsPerPack,
        batchNo: balance.lotBatch.batchNo,
        expiryDate: balance.lotBatch.expiryDate,
        lotStatus: balance.lotBatch.status,
        isSellable: balance.lotBatch.isSellable,
        onHandQuantity: balance.onHandQuantity,
        sellableQuantity: balance.sellableQuantity,
        isDefaultPack: balance.productPack.isDefault,
      };

      const currentAnchor = defaultRuntimeByProduct.get(productId);
      if (this.shouldReplaceRuntimeAnchor(candidate, currentAnchor)) {
        defaultRuntimeByProduct.set(productId, candidate);
      }
    }

    return {
      availabilityByProduct,
      defaultRuntimeByProduct,
    };
  }

  private shouldReplaceRuntimeAnchor(
    candidate: RuntimeAnchor,
    current?: RuntimeAnchor,
  ) {
    if (!current) {
      return true;
    }

    const candidateScore = this.scoreRuntimeAnchor(candidate);
    const currentScore = this.scoreRuntimeAnchor(current);
    if (candidateScore !== currentScore) {
      return candidateScore > currentScore;
    }

    const candidateExpiry = candidate.expiryDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const currentExpiry = current.expiryDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return candidateExpiry < currentExpiry;
  }

  private scoreRuntimeAnchor(anchor: RuntimeAnchor) {
    return (
      (anchor.sellableQuantity > 0 ? 10_000 : 0) +
      (anchor.isSellable ? 1_000 : 0) +
      (anchor.packSellability === 'READY' ? 100 : 0) +
      (anchor.isDefaultPack ? 10 : 0) +
      anchor.onHandQuantity
    );
  }

  private resolveMatchedFields(record: ProductListRecord, query: string) {
    const fields: string[] = [];
    const matchers: Array<[string, string | null | undefined]> = [
      ['barcode', record.barcode],
      ['nameAr', record.nameAr],
      ['nameEn', record.nameEn],
      ['tradeNameAr', record.tradeNameAr],
      ['tradeNameEn', record.tradeNameEn],
      ['genericNameAr', record.genericNameAr],
      ['genericNameEn', record.genericNameEn],
      ['categoryAr', record.categoryAr],
      ['categoryEn', record.categoryEn],
      ['strength', record.strength],
      ['packSize', record.packSize],
      ['taxProfileCode', record.taxProfileCode],
      ['supplier.nameAr', record.supplier?.nameAr],
      ['supplier.nameEn', record.supplier?.nameEn],
      ['supplier.code', record.supplier?.code],
      ['dosageForm.nameAr', record.dosageForm?.nameAr],
      ['dosageForm.nameEn', record.dosageForm?.nameEn],
    ];

    for (const [field, value] of matchers) {
      if (value?.toLowerCase().includes(query)) {
        fields.push(field);
      }
    }

    return fields;
  }

  private getSearchRank(record: ProductListRecord, query: string) {
    const values = [
      record.barcode,
      record.nameAr,
      record.nameEn,
      record.tradeNameAr,
      record.tradeNameEn,
      record.genericNameAr,
      record.genericNameEn,
      record.categoryAr,
      record.categoryEn,
      record.taxProfileCode,
      record.supplier?.code,
      record.supplier?.nameAr,
      record.supplier?.nameEn,
      record.dosageForm?.nameAr,
      record.dosageForm?.nameEn,
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase());

    if (record.barcode.toLowerCase() === query) {
      return 0;
    }
    if (record.barcode.toLowerCase().startsWith(query)) {
      return 1;
    }
    if (values.some((value) => value === query)) {
      return 2;
    }
    if (values.some((value) => value.startsWith(query))) {
      return 3;
    }
    return 4;
  }

  private async resolveDosageFormId(
    tx: Prisma.TransactionClient,
    tenantId: string,
    dosageFormId?: string,
    dosageFormName?: string,
  ) {
    if (dosageFormId) {
      const dosageForm = await tx.dosageForm.findFirst({
        where: { id: dosageFormId, tenantId },
        select: { id: true },
      });
      if (!dosageForm) {
        throw new NotFoundException('Dosage form not found in tenant.');
      }
      return dosageForm.id;
    }

    const normalizedName = this.normalizeOptional(dosageFormName);
    if (!normalizedName) {
      return null;
    }

    const dosageForm = await tx.dosageForm.upsert({
      where: {
        tenantId_nameEn: {
          tenantId,
          nameEn: normalizedName,
        },
      },
      update: {},
      create: {
        tenantId,
        nameEn: normalizedName,
        nameAr: normalizedName,
      },
      select: { id: true },
    });

    return dosageForm.id;
  }

  private async assertProductExists(
    db: WorkspaceClient,
    tenantId: string,
    productId: string,
  ) {
    const existing = await db.product.findFirst({
      where: { id: productId, tenantId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Product not found.');
    }
  }

  private resolveOptionalDate(value?: string) {
    const normalized = this.normalizeOptional(value);
    if (!normalized) {
      return null;
    }
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('expiryDate must be a valid ISO date string.');
    }
    return date;
  }

  private buildPackCode(barcode: string, nameEn: string) {
    const barcodeKey = barcode.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const nameKey = nameEn.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 16);
    return `${nameKey || 'PRODUCT'}-${barcodeKey || 'PACK'}`.slice(0, 60);
  }

  private buildBatchNo(barcode: string, nameEn: string) {
    const basis = `${nameEn}-${barcode}`
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase()
      .slice(-12);
    return `LOT-${basis || 'OPENING'}`.slice(0, 80);
  }

  private normalizeOptional(value?: string | null) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private rethrowUniqueConflict(error: unknown, message: string) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }
  }
}
