import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { ZonesModule } from './zones/zones.module';
import { RacksModule } from './racks/racks.module';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { BatchesModule } from './batches/batches.module';
import { InventoryLocationsModule } from './inventory-locations/inventory-locations.module';
import { InventoryCountsModule } from './inventory-counts/inventory-counts.module';
import { InventoryCountItemsModule } from './inventory-count-items/inventory-count-items.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    RolesModule,
    WarehousesModule,
    ZonesModule,
    RacksModule,
    CategoriesModule,
    ProductsModule,
    BatchesModule,
    InventoryLocationsModule,
    InventoryCountsModule,
    InventoryCountItemsModule,
    ApprovalsModule,
    AuditModule,
  ],
})
export class AppModule {}
