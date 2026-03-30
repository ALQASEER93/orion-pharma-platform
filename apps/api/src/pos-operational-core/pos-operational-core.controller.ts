import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { SalesPaymentMethod } from '@prisma/client';
import { Permissions } from '../common/decorators/permissions.decorator';
import type { RequestWithContext } from '../common/types/request-with-context.type';
import { resolveTenantId } from '../common/utils/tenant.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  PosAddCartLineDto,
  PosAddReturnLineDto,
  PosCreateCartSessionDto,
  PosCreateReturnSessionDto,
  PosFinalizeCashSaleDto,
  PosFinalizeReturnDto,
  PosOpenCartSessionsQueryDto,
  PosOperationalCatalogQueryDto,
  PosOperationalContextQueryDto,
  PosOperationalFinalizedSalesQueryDto,
  PosUpdateCartLineDto,
} from './pos-operational-core.http.dto';
import { PosOperationalCoreService } from './pos-operational-core.service';

const DEMO_TENANT_ID = '11111111-1111-1111-1111-111111111111';
const RETURN_ACCOUNTED_STATES = ['FINALIZED', 'QUEUED', 'ACCEPTED'] as const;

@Controller('pos/operational')
export class PosOperationalCoreController {
  constructor(
    private readonly service: PosOperationalCoreService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('context')
  @Permissions('pos.checkout')
  async getContext(
    @Req() request: RequestWithContext,
    @Query() query: PosOperationalContextQueryDto,
  ) {
    const tenantId = resolveTenantId(request);
    const branches = await this.prisma.branch.findMany({
      where: {
        tenantId,
        ...(query.branchId ? { id: query.branchId } : {}),
      },
      select: {
        id: true,
        name: true,
        legalEntityId: true,
      },
      orderBy: { name: 'asc' },
    });

    const registers = await this.prisma.register.findMany({
      where: {
        tenantId,
        ...(query.branchId ? { branchId: query.branchId } : {}),
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        nameEn: true,
        nameAr: true,
        branchId: true,
        legalEntityId: true,
      },
      orderBy: [{ branchId: 'asc' }, { code: 'asc' }],
    });

    const defaultBranchId = query.branchId ?? registers[0]?.branchId ?? branches[0]?.id ?? null;
    const defaultRegisterId =
      registers.find((item) => item.branchId === defaultBranchId)?.id ??
      registers[0]?.id ??
      null;

    return {
      tenantId,
      contextSource: tenantId === DEMO_TENANT_ID ? 'DEMO_SEED_OR_REAL_DB' : 'REAL_DB_RUNTIME',
      branches,
      registers,
      defaultBranchId,
      defaultRegisterId,
    };
  }

  @Get('catalog')
  @Permissions('pos.checkout')
  async getCatalog(
    @Req() request: RequestWithContext,
    @Query() query: PosOperationalCatalogQueryDto,
  ) {
    const tenantId = resolveTenantId(request);
    const search = query.search?.trim();
    const packs = await this.prisma.productPack.findMany({
      where: {
        tenantId,
        ...(search
          ? {
              OR: [
                { code: { contains: search } },
                { barcode: { contains: search } },
                { product: { nameEn: { contains: search } } },
                { product: { nameAr: { contains: search } } },
                { product: { barcode: { contains: search } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        code: true,
        barcode: true,
        status: true,
        sellability: true,
        unitsPerPack: true,
        product: {
          select: {
            id: true,
            nameEn: true,
            nameAr: true,
            barcode: true,
            isActive: true,
          },
        },
        lotBatches: {
          where: {
            tenantId,
          },
          select: {
            id: true,
            batchNo: true,
            expiryDate: true,
            status: true,
            isSellable: true,
            inventoryLotBalances: {
              where: {
                tenantId,
                branchId: query.branchId,
              },
              select: {
                onHandQuantity: true,
                sellableQuantity: true,
                quarantinedQuantity: true,
                expiredQuantity: true,
              },
            },
          },
          orderBy: [{ expiryDate: 'asc' }, { batchNo: 'asc' }],
        },
      },
      orderBy: [{ product: { nameEn: 'asc' } }, { code: 'asc' }],
      take: 120,
    });

    return packs
      .map((pack) => ({
        packId: pack.id,
        packCode: pack.code,
        packBarcode: pack.barcode,
        packStatus: pack.status,
        packSellability: pack.sellability,
        unitsPerPack: pack.unitsPerPack,
        product: pack.product,
        lots: pack.lotBatches.map((lot) => {
          const branchBalance = lot.inventoryLotBalances[0];
          return {
            lotBatchId: lot.id,
            batchNo: lot.batchNo,
            expiryDate: lot.expiryDate,
            status: lot.status,
            isSellable: lot.isSellable,
            onHandQuantity: branchBalance?.onHandQuantity ?? 0,
            sellableQuantity: branchBalance?.sellableQuantity ?? 0,
            quarantinedQuantity: branchBalance?.quarantinedQuantity ?? 0,
            expiredQuantity: branchBalance?.expiredQuantity ?? 0,
          };
        }),
      }))
      .filter((item) => item.lots.length > 0);
  }

  @Get('cart-sessions')
  @Permissions('pos.checkout')
  listOpenCartSessions(
    @Req() request: RequestWithContext,
    @Query() query: PosOpenCartSessionsQueryDto,
  ) {
    return this.prisma.posCartSession.findMany({
      where: {
        tenantId: resolveTenantId(request),
        state: { in: ['OPEN', 'PAYMENT_PENDING'] },
        ...(query.branchId ? { branchId: query.branchId } : {}),
        ...(query.registerId ? { registerId: query.registerId } : {}),
      },
      select: {
        id: true,
        sessionNumber: true,
        state: true,
        branchId: true,
        registerId: true,
        subtotal: true,
        discountTotal: true,
        taxTotal: true,
        grandTotal: true,
        openedAt: true,
      },
      orderBy: { openedAt: 'desc' },
      take: 25,
    });
  }

  @Post('cart-sessions')
  @Permissions('pos.checkout')
  createCartSession(
    @Req() request: RequestWithContext,
    @Body() dto: PosCreateCartSessionDto,
  ) {
    return this.service.createCartSession({
      tenantId: resolveTenantId(request),
      legalEntityId: dto.legalEntityId,
      branchId: dto.branchId,
      registerId: dto.registerId,
      currency: dto.currency,
      notes: dto.notes,
      createdBy: request.user?.sub,
    });
  }

  @Get('cart-sessions/:id')
  @Permissions('pos.checkout')
  getCartSession(@Req() request: RequestWithContext, @Param('id') id: string) {
    return this.service.getCartSession(resolveTenantId(request), id);
  }

  @Post('cart-sessions/:id/lines')
  @Permissions('pos.checkout')
  addCartLine(
    @Req() request: RequestWithContext,
    @Param('id') cartSessionId: string,
    @Body() dto: PosAddCartLineDto,
  ) {
    return this.service.addCartLine({
      tenantId: resolveTenantId(request),
      cartSessionId,
      lineNo: dto.lineNo,
      productPackId: dto.productPackId,
      lotBatchId: dto.lotBatchId,
      quantity: dto.quantity,
      unitPrice: dto.unitPrice,
      discount: dto.discount,
      taxRate: dto.taxRate,
      notes: dto.notes,
    });
  }

  @Patch('cart-sessions/:id/lines/:lineId')
  @Permissions('pos.checkout')
  updateCartLine(
    @Req() request: RequestWithContext,
    @Param('id') cartSessionId: string,
    @Param('lineId') lineId: string,
    @Body() dto: PosUpdateCartLineDto,
  ) {
    return this.service.updateCartLine({
      tenantId: resolveTenantId(request),
      cartSessionId,
      cartLineId: lineId,
      quantity: dto.quantity,
      unitPrice: dto.unitPrice,
      discount: dto.discount,
      taxRate: dto.taxRate,
      notes: dto.notes,
    });
  }

  @Delete('cart-sessions/:id/lines/:lineId')
  @Permissions('pos.checkout')
  removeCartLine(
    @Req() request: RequestWithContext,
    @Param('id') cartSessionId: string,
    @Param('lineId') lineId: string,
  ) {
    return this.service.removeCartLine({
      tenantId: resolveTenantId(request),
      cartSessionId,
      cartLineId: lineId,
    });
  }

  @Post('cart-sessions/:id/finalize-cash')
  @Permissions('pos.checkout')
  finalizeCashSale(
    @Req() request: RequestWithContext,
    @Param('id') cartSessionId: string,
    @Body() dto: PosFinalizeCashSaleDto,
  ) {
    return this.service.finalizeCartPayment({
      tenantId: resolveTenantId(request),
      cartSessionId,
      paymentMethod: SalesPaymentMethod.CASH,
      amountApplied: dto.amountApplied,
      amountTendered: dto.amountTendered,
      paymentReference: dto.paymentReference,
      notes: dto.notes,
      createdBy: request.user?.sub,
    });
  }

  @Get('finalized-sales')
  @Permissions('pos.checkout')
  listFinalizedSales(
    @Req() request: RequestWithContext,
    @Query() query: PosOperationalFinalizedSalesQueryDto,
  ) {
    const tenantId = resolveTenantId(request);
    const search = query.search?.trim();
    return this.prisma.fiscalSaleDocument.findMany({
      where: {
        tenantId,
        state: { in: ['FINALIZED', 'ACCEPTED'] },
        ...(query.branchId ? { branchId: query.branchId } : {}),
        ...(search
          ? {
              OR: [{ documentNo: { contains: search } }],
            }
          : {}),
      },
      select: {
        id: true,
        documentNo: true,
        state: true,
        branchId: true,
        registerId: true,
        grandTotal: true,
        currency: true,
        finalizedAt: true,
        createdAt: true,
      },
      orderBy: [{ finalizedAt: 'desc' }, { createdAt: 'desc' }],
      take: 80,
    });
  }

  @Get('finalized-sales/:id')
  @Permissions('pos.checkout')
  async getFinalizedSaleDetail(
    @Req() request: RequestWithContext,
    @Param('id') saleId: string,
  ) {
    const tenantId = resolveTenantId(request);
    const sale = await this.prisma.fiscalSaleDocument.findFirst({
      where: {
        id: saleId,
        tenantId,
        state: { in: ['FINALIZED', 'ACCEPTED'] },
      },
      select: {
        id: true,
        documentNo: true,
        state: true,
        branchId: true,
        registerId: true,
        grandTotal: true,
        currency: true,
        finalizedAt: true,
        lines: {
          orderBy: { lineNo: 'asc' },
          select: {
            id: true,
            lineNo: true,
            productPackId: true,
            lotBatchId: true,
            quantity: true,
            unitPrice: true,
            taxRate: true,
            discount: true,
            lineTotal: true,
            productPack: {
              select: {
                code: true,
                barcode: true,
                product: {
                  select: {
                    nameEn: true,
                    nameAr: true,
                  },
                },
              },
            },
            lotBatch: {
              select: {
                batchNo: true,
                expiryDate: true,
              },
            },
          },
        },
      },
    });
    if (!sale) {
      return null;
    }

    const sourceLineIds = sale.lines.map((line) => line.id);
    const returnedLines = sourceLineIds.length
      ? await this.prisma.fiscalReturnDocumentLine.findMany({
          where: {
            tenantId,
            sourceSaleLineId: { in: sourceLineIds },
            returnDocument: {
              state: { in: [...RETURN_ACCOUNTED_STATES] },
            },
          },
          select: {
            sourceSaleLineId: true,
            quantity: true,
          },
        })
      : [];

    const returnedBySourceLine = returnedLines.reduce<Map<string, number>>(
      (acc, row) => {
        if (!row.sourceSaleLineId) {
          return acc;
        }
        acc.set(
          row.sourceSaleLineId,
          (acc.get(row.sourceSaleLineId) ?? 0) + row.quantity,
        );
        return acc;
      },
      new Map<string, number>(),
    );

    return {
      ...sale,
      lines: sale.lines.map((line) => {
        const alreadyReturnedQty = returnedBySourceLine.get(line.id) ?? 0;
        return {
          ...line,
          alreadyReturnedQty,
          remainingQty: Math.max(line.quantity - alreadyReturnedQty, 0),
        };
      }),
    };
  }

  @Post('return-sessions')
  @Permissions('pos.checkout')
  createReturnSession(
    @Req() request: RequestWithContext,
    @Body() dto: PosCreateReturnSessionDto,
  ) {
    return this.service.createReturnSession({
      tenantId: resolveTenantId(request),
      legalEntityId: dto.legalEntityId,
      branchId: dto.branchId,
      registerId: dto.registerId,
      sourceSaleDocumentId: dto.sourceSaleDocumentId,
      reasonCode: dto.reasonCode,
      currency: dto.currency,
      notes: dto.notes,
      createdBy: request.user?.sub,
    });
  }

  @Get('return-sessions/:id')
  @Permissions('pos.checkout')
  getReturnSession(
    @Req() request: RequestWithContext,
    @Param('id') returnSessionId: string,
  ) {
    return this.service.getReturnSession(resolveTenantId(request), returnSessionId);
  }

  @Post('return-sessions/:id/lines')
  @Permissions('pos.checkout')
  addReturnLine(
    @Req() request: RequestWithContext,
    @Param('id') returnSessionId: string,
    @Body() dto: PosAddReturnLineDto,
  ) {
    return this.service.addReturnLine({
      tenantId: resolveTenantId(request),
      returnSessionId,
      sourceSaleLineId: dto.sourceSaleLineId,
      lineNo: dto.lineNo,
      productPackId: dto.productPackId,
      lotBatchId: dto.lotBatchId,
      quantityReturned: dto.quantityReturned,
      unitPrice: dto.unitPrice,
      discount: dto.discount,
      taxRate: dto.taxRate,
      reasonCode: dto.reasonCode,
      notes: dto.notes,
    });
  }

  @Post('return-sessions/:id/finalize')
  @Permissions('pos.checkout')
  finalizeReturn(
    @Req() request: RequestWithContext,
    @Param('id') returnSessionId: string,
    @Body() dto: PosFinalizeReturnDto,
  ) {
    return this.service.finalizeReturn({
      tenantId: resolveTenantId(request),
      returnSessionId,
      refundMethod: SalesPaymentMethod.CASH,
      refundAmount: dto.refundAmount,
      refundReference: dto.refundReference,
      notes: dto.notes,
      createdBy: request.user?.sub,
    });
  }
}
