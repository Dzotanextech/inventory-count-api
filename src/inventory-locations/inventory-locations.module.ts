import { Module } from '@nestjs/common';
import { InventoryLocationsService } from './inventory-locations.service';
import { InventoryLocationsController } from './inventory-locations.controller';

@Module({
  controllers: [InventoryLocationsController],
  providers: [InventoryLocationsService],
  exports: [InventoryLocationsService],
})
export class InventoryLocationsModule {}
