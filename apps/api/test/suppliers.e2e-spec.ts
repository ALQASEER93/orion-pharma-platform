import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { Server } from 'http';
import { AppModule } from '../src/app.module';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { resolveOrionDatabaseUrl } from '../src/prisma/orion-database-url';

const tenantId = '11111111-1111-1111-1111-111111111111';
const otherTenantId = '99999999-9999-9999-9999-999999999999';
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123';
const branchId = '22222222-2222-2222-2222-222222222222';
let prisma: PrismaClient;

function ensureDatabaseUrl() {
  if (process.env.ORION_DATABASE_URL) {
    return;
  }

  const provider = (process.env.ORION_DB_PROVIDER ?? 'sqlite').toLowerCase();
  if (provider === 'postgresql') {
    const host = process.env.ORION_DB_HOST ?? 'localhost';
    const port = process.env.ORION_DB_PORT ?? '5432';
    const db = process.env.ORION_DB_NAME ?? 'orion_pharma';
    const user = process.env.ORION_DB_USER ?? 'postgres';
    const password = process.env.ORION_DB_PASSWORD ?? 'postgres';
    process.env.ORION_DATABASE_URL = `postgresql://${user}:${password}@${host}:${port}/${db}?schema=public`;
    return;
  }

  process.env.ORION_DATABASE_URL = resolveOrionDatabaseUrl();
}

describe('Suppliers (e2e)', () => {
  let app: INestApplication;
  let accessToken = '';

  beforeAll(async () => {
    process.env.ORION_JWT_SECRET = 'ORION_e2e_test_secret_value_123456';
    delete process.env.JWT_SECRET;
    ensureDatabaseUrl();
    prisma = new PrismaClient();
    await ensureAdminFixture();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    const loginResponse = await request(app.getHttpServer() as Server)
      .post('/api/auth/login')
      .send({
        email: 'admin@orion.local',
        password: adminPassword,
        tenantId,
      })
      .set('x-tenant-id', tenantId);

    expect(loginResponse.status).toBe(201);
    expect(loginResponse.body.access_token).toBeTruthy();
    accessToken = loginResponse.body.access_token as string;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  it('creates and lists suppliers in current tenant only', async () => {
    const server = app.getHttpServer() as Server;
    const codeSuffix = Date.now().toString();
    const supplierCode = `SUP-E2E-${codeSuffix}`;

    const createResponse = await request(server)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        code: supplierCode,
        nameAr: 'مورد تجريبي',
        nameEn: 'E2E Supplier',
        contactName: 'QA User',
        phone: '+966500000009',
        email: 'supplier-e2e@orion.local',
      });

    expect(createResponse.status).toBe(201);

    const listResponse = await request(server)
      .get('/api/suppliers')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);

    expect(listResponse.status).toBe(200);
    expect(
      (listResponse.body as Array<{ code: string }>).some(
        (item) => item.code === supplierCode,
      ),
    ).toBe(true);
    expect(
      (listResponse.body as Array<{ code: string }>).some(
        (item) => item.code === 'SUP-OTHER-TENANT',
      ),
    ).toBe(false);
  });

  it('rejects duplicate supplier code in same tenant', async () => {
    const server = app.getHttpServer() as Server;

    const response = await request(server)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        code: 'SUP-ORION-001',
        nameAr: 'مورد مكرر',
        nameEn: 'Duplicate Supplier',
      });

    expect(response.status).toBe(409);
  });

  it('updates supplier and enforces tenant-safe not-found boundaries', async () => {
    const server = app.getHttpServer() as Server;
    const uniqueCode = `SUP-UPD-${Date.now()}`;

    const createResponse = await request(server)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        code: uniqueCode,
        nameAr: 'مورد تحديث',
        nameEn: 'Supplier Update',
      });
    expect(createResponse.status).toBe(201);

    const supplierId = (createResponse.body as { id: string }).id;

    const updateResponse = await request(server)
      .patch(`/api/suppliers/${supplierId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        nameEn: 'Supplier Updated Name',
        contactName: 'Updated Contact',
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.nameEn).toBe('Supplier Updated Name');
    expect(updateResponse.body.contactName).toBe('Updated Contact');

    const otherTenantUpdate = await request(server)
      .patch('/api/suppliers/00000000-0000-0000-0000-000000000999')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', otherTenantId)
      .send({
        nameEn: 'Should Not Update',
      });

    expect(otherTenantUpdate.status).toBe(404);
  });

  it('rejects supplier code collisions on update', async () => {
    const server = app.getHttpServer() as Server;
    const baseSuffix = Date.now().toString();

    const first = await request(server)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        code: `SUP-COLL-A-${baseSuffix}`,
        nameAr: 'مورد أ',
        nameEn: 'Supplier A',
      });
    expect(first.status).toBe(201);

    const second = await request(server)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        code: `SUP-COLL-B-${baseSuffix}`,
        nameAr: 'مورد ب',
        nameEn: 'Supplier B',
      });
    expect(second.status).toBe(201);

    const secondId = (second.body as { id: string }).id;
    const collision = await request(server)
      .patch(`/api/suppliers/${secondId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        code: `SUP-COLL-A-${baseSuffix}`,
      });

    expect(collision.status).toBe(409);
  });
});

async function ensureAdminFixture() {
  await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {},
    create: {
      id: tenantId,
      name: 'ORION Pharma Demo Tenant',
      subscriptionPlan: 'enterprise',
    },
  });

  await prisma.tenant.upsert({
    where: { id: otherTenantId },
    update: {},
    create: {
      id: otherTenantId,
      name: 'ORION Secondary Tenant',
      subscriptionPlan: 'basic',
    },
  });

  const role = await prisma.role.upsert({
    where: {
      tenantId_name: {
        tenantId,
        name: 'admin',
      },
    },
    update: {},
    create: {
      tenantId,
      name: 'admin',
    },
  });

  const supplierReadPermission = await prisma.permission.upsert({
    where: { key: 'suppliers.read' },
    update: {},
    create: { key: 'suppliers.read' },
  });
  const supplierManagePermission = await prisma.permission.upsert({
    where: { key: 'suppliers.manage' },
    update: {},
    create: { key: 'suppliers.manage' },
  });

  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: role.id,
        permissionId: supplierReadPermission.id,
      },
    },
    update: {},
    create: {
      roleId: role.id,
      permissionId: supplierReadPermission.id,
    },
  });

  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: role.id,
        permissionId: supplierManagePermission.id,
      },
    },
    update: {},
    create: {
      roleId: role.id,
      permissionId: supplierManagePermission.id,
    },
  });

  await prisma.branch.upsert({
    where: { id: branchId },
    update: {
      name: 'Main Branch',
      location: 'Riyadh',
      tenantId,
    },
    create: {
      id: branchId,
      tenantId,
      name: 'Main Branch',
      location: 'Riyadh',
    },
  });

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.user.upsert({
    where: { email: 'admin@orion.local' },
    update: {
      tenantId,
      branchId,
      roleId: role.id,
      passwordHash,
      isActive: true,
    },
    create: {
      tenantId,
      branchId,
      roleId: role.id,
      email: 'admin@orion.local',
      passwordHash,
      isActive: true,
    },
  });

  await prisma.supplier.upsert({
    where: {
      tenantId_code: {
        tenantId,
        code: 'SUP-ORION-001',
      },
    },
    update: {
      nameAr: 'مورد قياسي',
      nameEn: 'Standard Supplier',
      isActive: true,
    },
    create: {
      tenantId,
      code: 'SUP-ORION-001',
      nameAr: 'مورد قياسي',
      nameEn: 'Standard Supplier',
      isActive: true,
    },
  });

  await prisma.supplier.upsert({
    where: {
      tenantId_code: {
        tenantId: otherTenantId,
        code: 'SUP-OTHER-TENANT',
      },
    },
    update: {},
    create: {
      tenantId: otherTenantId,
      code: 'SUP-OTHER-TENANT',
      nameAr: 'مورد مستأجر آخر',
      nameEn: 'Other Tenant Supplier',
      isActive: true,
    },
  });
}
