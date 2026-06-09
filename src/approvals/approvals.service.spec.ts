import { Test, TestingModule } from '@nestjs/testing';
import { ApprovalsService } from './approvals.service';
import { PrismaService } from '../prisma/prisma.service';
import { createMockPrismaService } from '../common/testing/prisma.mock';

describe('ApprovalsService', () => {
  let service: ApprovalsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApprovalsService,
        { provide: PrismaService, useValue: createMockPrismaService() },
      ],
    }).compile();

    service = module.get<ApprovalsService>(ApprovalsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
