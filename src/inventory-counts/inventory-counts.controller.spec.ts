import { Test, TestingModule } from '@nestjs/testing';
import { InventoryCountsController } from './inventory-counts.controller';
import { InventoryCountsService } from './inventory-counts.service';

describe('InventoryCountsController', () => {
  let controller: InventoryCountsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryCountsController],
      providers: [{ provide: InventoryCountsService, useValue: {} }],
    }).compile();

    controller = module.get<InventoryCountsController>(InventoryCountsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
