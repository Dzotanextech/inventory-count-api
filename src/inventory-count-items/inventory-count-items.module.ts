import { Module } from '@nestjs/common';
import { InventoryCountItemsService } from './inventory-count-items.service';
import { InventoryCountItemsController } from './inventory-count-items.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [InventoryCountItemsController],
  providers: [InventoryCountItemsService],
  exports: [InventoryCountItemsService],
})
export class InventoryCountItemsModule {}
