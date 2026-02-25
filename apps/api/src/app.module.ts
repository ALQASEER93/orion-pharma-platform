import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { TenantIsolationMiddleware } from './common/middleware/tenant-isolation.middleware';
import { RoleCheckMiddleware } from './common/middleware/role-check.middleware';
import { ProductsModule } from './products/products.module';
import { InventoryModule } from './inventory/inventory.module';
import { TaxonomyModule } from './taxonomy/taxonomy.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { CustomersModule } from './customers/customers.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { GoodsReceiptsModule } from './goods-receipts/goods-receipts.module';
import { ProcurementTransactionsModule } from './procurement-transactions/procurement-transactions.module';
import { ProcurementReportsModule } from './procurement-reports/procurement-reports.module';
import { SalesModule } from './sales/sales.module';
import { AccountingModule } from './accounting/accounting.module';
import { ArModule } from './ar/ar.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    TaxonomyModule,
    ProductsModule,
    InventoryModule,
    SuppliersModule,
    CustomersModule,
    PurchaseOrdersModule,
    GoodsReceiptsModule,
    ProcurementTransactionsModule,
    ProcurementReportsModule,
    SalesModule,
    AccountingModule,
    ArModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TenantIsolationMiddleware, RoleCheckMiddleware)
      .forRoutes('*');
  }
}
