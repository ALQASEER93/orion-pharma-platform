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

  const permissionKeys = ['users.read', 'users.manage', 'inventory.read'];
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

  await prisma.user.upsert({
    where: { email: 'admin@orion.local' },
    update: {
      passwordHash,
      tenantId: tenant.id,
      roleId: role.id,
      isActive: true,
    },
    create: {
      tenantId: tenant.id,
      roleId: role.id,
      email: 'admin@orion.local',
      passwordHash,
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
