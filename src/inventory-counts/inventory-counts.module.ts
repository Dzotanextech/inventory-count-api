import { Module } from '@nestjs/common';
import { InventoryCountsService } from './inventory-counts.service';
import { InventoryCountsController } from './inventory-counts.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [InventoryCountsController],
  providers: [InventoryCountsService],
  exports: [InventoryCountsService],
})
export class InventoryCountsModule {}
