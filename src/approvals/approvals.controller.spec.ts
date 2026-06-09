import { Test, TestingModule } from '@nestjs/testing';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';

describe('ApprovalsController', () => {
  let controller: ApprovalsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApprovalsController],
      providers: [{ provide: ApprovalsService, useValue: {} }],
    }).compile();

    controller = module.get<ApprovalsController>(ApprovalsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
