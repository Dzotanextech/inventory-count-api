import { Test, TestingModule } from '@nestjs/testing';
import { InventoryCountsService } from './inventory-counts.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { createMockPrismaService } from '../common/testing/prisma.mock';

describe('InventoryCountsService', () => {
  let service: InventoryCountsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryCountsService,
        { provide: PrismaService, useValue: createMockPrismaService() },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get<InventoryCountsService>(InventoryCountsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
