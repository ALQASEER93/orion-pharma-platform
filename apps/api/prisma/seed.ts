import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { id: '11111111-1111-1111-1111-111111111111' },
    update: {},
    create: {
      id: '11111111-1111-1111-1111-111111111111',
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
    where: { id: '22222222-2222-2222-2222-222222222222' },
    update: {
      name: 'Main Branch',
      location: 'Riyadh',
    },
    create: {
      id: '22222222-2222-2222-2222-222222222222',
      tenantId: tenant.id,
      name: 'Main Branch',
      location: 'Riyadh',
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

  await prisma.product.upsert({
    where: {
      tenantId_barcode: {
        tenantId: tenant.id,
        barcode: 'ORION-AMOX-500',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      nameAr: 'أموكسيسيلين 500',
      nameEn: 'Amoxicillin 500',
      barcode: 'ORION-AMOX-500',
      strength: '500mg',
      packSize: '20 tabs',
      trackingMode: 'LOT_EXPIRY',
      therapeuticClassId: therapeuticClass.id,
      dosageFormId: dosageForm.id,
      storageConditionId: storageCondition.id,
      regulatoryTypeId: regulatoryType.id,
    },
  });

  await prisma.supplier.upsert({
    where: {
      tenantId_code: {
        tenantId: tenant.id,
        code: 'SUP-ORION-001',
      },
    },
    update: {
      nameAr: 'المورد الطبي الأول',
      nameEn: 'First Medical Supplier',
      contactName: 'ORION Supply Team',
      email: 'supply1@orion.local',
      phone: '+966500000001',
      preferredPaymentTerm: 'NET 30',
      isActive: true,
    },
    create: {
      tenantId: tenant.id,
      code: 'SUP-ORION-001',
      nameAr: 'المورد الطبي الأول',
      nameEn: 'First Medical Supplier',
      contactName: 'ORION Supply Team',
      email: 'supply1@orion.local',
      phone: '+966500000001',
      address: 'Riyadh Industrial Zone',
      preferredPaymentTerm: 'NET 30',
      isActive: true,
    },
  });
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
