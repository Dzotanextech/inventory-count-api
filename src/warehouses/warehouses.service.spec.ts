import { Test, TestingModule } from '@nestjs/testing';
import { WarehousesService } from './warehouses.service';
import { PrismaService } from '../prisma/prisma.service';
import { createMockPrismaService } from '../common/testing/prisma.mock';

describe('WarehousesService', () => {
  let service: WarehousesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarehousesService,
        { provide: PrismaService, useValue: createMockPrismaService() },
      ],
    }).compile();

    service = module.get<WarehousesService>(WarehousesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
