import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { id: '11111111-1111-4111-8111-111111111111' },
    update: {},
    create: {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'ORION Pharma Demo Tenant',
      subscriptionPlan: 'enterprise',
    },
  });

  const permissionKeys = [
    'users.read',
    'users.manage',
    'products.read',
    'products.manage',
    'suppliers.read',
    'suppliers.manage',
    'customers.read',
    'customers.manage',
    'sales_invoices.read',
    'sales_invoices.manage',
    'pos.checkout',
    'purchase_orders.read',
    'purchase_orders.manage',
    'goods_receipts.read',
    'goods_receipts.manage',
    'purchase_returns.read',
    'purchase_returns.manage',
    'procurement_adjustments.read',
    'procurement_adjustments.manage',
    'inventory_adjustments.manage',
    'inventory.read',
    'inventory.adjust',
    'inventory.override_negative',
    'accounting.read',
    'accounting.manage',
    'ar.read',
    'ar.manage',
  ];
  for (const key of permissionKeys) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key },
    });
  }

  const role = await prisma.role.upsert({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: 'admin',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'admin',
    },
  });

  const permissions = await prisma.permission.findMany({
    where: { key: { in: permissionKeys } },
  });

  for (const permission of permissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: role.id,
        permissionId: permission.id,
      },
    });
  }

  const passwordHash = await bcrypt.hash(
    process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123',
    10,
  );

  const branch = await prisma.branch.upsert({
    where: { id: '22222222-2222-4222-8222-222222222222' },
    update: {
      name: 'Main Branch',
      location: 'Amman',
    },
    create: {
      id: '22222222-2222-4222-8222-222222222222',
      tenantId: tenant.id,
      name: 'Main Branch',
      location: 'Amman',
    },
  });

  const legalEntity = await prisma.legalEntity.upsert({
    where: {
      tenantId_code: {
        tenantId: tenant.id,
        code: 'ORION-HQ',
      },
    },
    update: {
      nameAr: 'شركة أوريون فارما',
      nameEn: 'ORION Pharma HQ',
      registrationNumber: 'ORION-DEMO-REG',
      taxNumber: 'ORION-DEMO-TAX',
      isActive: true,
    },
    create: {
      id: '33333333-3333-4333-8333-333333333333',
      tenantId: tenant.id,
      code: 'ORION-HQ',
      nameAr: 'شركة أوريون فارما',
      nameEn: 'ORION Pharma HQ',
      registrationNumber: 'ORION-DEMO-REG',
      taxNumber: 'ORION-DEMO-TAX',
      isActive: true,
    },
  });

  await prisma.branch.update({
    where: { id: branch.id },
    data: {
      legalEntityId: legalEntity.id,
    },
  });

  const register = await prisma.register.upsert({
    where: {
      tenantId_branchId_code: {
        tenantId: tenant.id,
        branchId: branch.id,
        code: 'POS-01',
      },
    },
    update: {
      legalEntityId: legalEntity.id,
      nameEn: 'Cashier Counter 01',
      nameAr: 'كاشير 01',
      isActive: true,
    },
    create: {
      id: '44444444-4444-4444-8444-444444444444',
      tenantId: tenant.id,
      legalEntityId: legalEntity.id,
      branchId: branch.id,
      code: 'POS-01',
      nameEn: 'Cashier Counter 01',
      nameAr: 'كاشير 01',
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@orion.local' },
    update: {
      passwordHash,
      tenantId: tenant.id,
      branchId: branch.id,
      roleId: role.id,
      isActive: true,
    },
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      roleId: role.id,
      email: 'admin@orion.local',
      passwordHash,
      isActive: true,
    },
  });

  const therapeuticClass = await prisma.therapeuticClass.upsert({
    where: {
      tenantId_nameEn: {
        tenantId: tenant.id,
        nameEn: 'Antibiotics',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      nameAr: 'مضادات حيوية',
      nameEn: 'Antibiotics',
    },
  });

  const dosageForm = await prisma.dosageForm.upsert({
    where: {
      tenantId_nameEn: {
        tenantId: tenant.id,
        nameEn: 'Tablet',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      nameAr: 'أقراص',
      nameEn: 'Tablet',
    },
  });

  const storageCondition = await prisma.storageCondition.upsert({
    where: {
      tenantId_nameEn: {
        tenantId: tenant.id,
        nameEn: 'Room Temperature',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      nameAr: 'درجة حرارة الغرفة',
      nameEn: 'Room Temperature',
    },
  });

  const regulatoryType = await prisma.regulatoryType.upsert({
    where: {
      tenantId_nameEn: {
        tenantId: tenant.id,
        nameEn: 'Prescription',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      nameAr: 'بوصفة طبية',
      nameEn: 'Prescription',
    },
  });

  const supplier = await prisma.supplier.upsert({
    where: {
      tenantId_code: {
        tenantId: tenant.id,
        code: 'SUP-ORION-001',
      },
    },
    update: {
      nameAr: 'المورد الطبي الأول',
      nameEn: 'First Medical Supplier',
      contactName: 'ORION Jordan Supply Team',
      email: 'supply1@orion.local',
      phone: '+962790000001',
      address: 'Amman Industrial Estate',
      preferredPaymentTerm: 'NET 30',
      isActive: true,
    },
    create: {
      tenantId: tenant.id,
      code: 'SUP-ORION-001',
      nameAr: 'المورد الطبي الأول',
      nameEn: 'First Medical Supplier',
      contactName: 'ORION Jordan Supply Team',
      email: 'supply1@orion.local',
      phone: '+962790000001',
      address: 'Amman Industrial Estate',
      preferredPaymentTerm: 'NET 30',
      isActive: true,
    },
  });

  const product = await prisma.product.upsert({
    where: {
      tenantId_barcode: {
        tenantId: tenant.id,
        barcode: 'ORION-AMOX-500',
      },
    },
    update: {
      tradeNameEn: 'Amoxicillin 500',
      tradeNameAr: 'أموكسيسيلين 500',
      genericNameEn: 'Amoxicillin',
      genericNameAr: 'أموكسيسيلين',
      categoryEn: 'Medicine',
      categoryAr: 'دواء',
      defaultSalePrice: 4.5,
      taxProfileCode: 'READINESS_STANDARD',
      therapeuticClassId: therapeuticClass.id,
      dosageFormId: dosageForm.id,
      storageConditionId: storageCondition.id,
      regulatoryTypeId: regulatoryType.id,
      supplierId: supplier.id,
    },
    create: {
      tenantId: tenant.id,
      nameAr: 'أموكسيسيلين 500',
      nameEn: 'Amoxicillin 500',
      tradeNameAr: 'أموكسيسيلين 500',
      tradeNameEn: 'Amoxicillin 500',
      genericNameAr: 'أموكسيسيلين',
      genericNameEn: 'Amoxicillin',
      categoryAr: 'دواء',
      categoryEn: 'Medicine',
      barcode: 'ORION-AMOX-500',
      strength: '500mg',
      packSize: '20 tabs',
      defaultSalePrice: 4.5,
      taxProfileCode: 'READINESS_STANDARD',
      trackingMode: 'LOT_EXPIRY',
      therapeuticClassId: therapeuticClass.id,
      dosageFormId: dosageForm.id,
      storageConditionId: storageCondition.id,
      regulatoryTypeId: regulatoryType.id,
      supplierId: supplier.id,
    },
  });

  const productPack = await prisma.productPack.upsert({
    where: {
      tenantId_code: {
        tenantId: tenant.id,
        code: 'AMOX500-TABS-20',
      },
    },
    update: {
      productId: product.id,
      barcode: product.barcode,
      unitsPerPack: 1,
      status: 'ACTIVE',
      sellability: 'READY',
      isDefault: true,
    },
    create: {
      tenantId: tenant.id,
      productId: product.id,
      code: 'AMOX500-TABS-20',
      barcode: product.barcode,
      unitsPerPack: 1,
      status: 'ACTIVE',
      sellability: 'READY',
      isDefault: true,
    },
  });

  const lotBatch = await prisma.lotBatch.upsert({
    where: {
      tenantId_productPackId_batchNo: {
        tenantId: tenant.id,
        productPackId: productPack.id,
        batchNo: 'AMOX-LOT-2026A',
      },
    },
    update: {
      expiryDate: new Date('2027-12-31T00:00:00.000Z'),
      status: 'SELLABLE',
      isSellable: true,
    },
    create: {
      tenantId: tenant.id,
      productPackId: productPack.id,
      batchNo: 'AMOX-LOT-2026A',
      expiryDate: new Date('2027-12-31T00:00:00.000Z'),
      status: 'SELLABLE',
      isSellable: true,
    },
  });

  await prisma.inventoryLotBalance.upsert({
    where: {
      tenantId_branchId_productPackId_lotBatchId: {
        tenantId: tenant.id,
        branchId: branch.id,
        productPackId: productPack.id,
        lotBatchId: lotBatch.id,
      },
    },
    update: {
      onHandQuantity: 24,
      sellableQuantity: 24,
      quarantinedQuantity: 0,
      expiredQuantity: 0,
    },
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      productPackId: productPack.id,
      lotBatchId: lotBatch.id,
      onHandQuantity: 24,
      sellableQuantity: 24,
      quarantinedQuantity: 0,
      expiredQuantity: 0,
    },
  });

  const existingFoundationEntry = await prisma.inventoryLedgerEntry.findFirst({
    where: {
      tenantId: tenant.id,
      referenceType: 'FOUNDATION',
      referenceId: product.id,
      referenceLineId: lotBatch.id,
      reasonCode: 'SEED_FOUNDATION_OPENING_STOCK',
    },
    select: { id: true },
  });

  if (!existingFoundationEntry) {
    await prisma.inventoryLedgerEntry.create({
      data: {
        tenantId: tenant.id,
        legalEntityId: legalEntity.id,
        branchId: branch.id,
        registerId: register.id,
        productPackId: productPack.id,
        lotBatchId: lotBatch.id,
        entryType: 'STOCK_IN',
        postingSurface: 'BRANCH',
        referenceType: 'FOUNDATION',
        referenceId: product.id,
        referenceLineId: lotBatch.id,
        reasonCode: 'SEED_FOUNDATION_OPENING_STOCK',
        stockBucket: 'SELLABLE',
        quantityDelta: 24,
        unitCost: null,
        amountTotal: 108,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

