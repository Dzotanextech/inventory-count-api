import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateInventoryCountDto } from './dto/create-inventory-count.dto';
import { QueryInventoryCountDto } from './dto/query-inventory-count.dto';
import { paginate } from '../common/dto/pagination.dto';
import { InventoryCountStatus, InventoryCountType, ApprovalAction, Prisma } from '@prisma/client';

const COUNT_INCLUDE = {
  warehouse: { select: { id: true, code: true, name: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  submittedBy: { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
  _count: { select: { items: true } },
};

@Injectable()
export class InventoryCountsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findAll(query: QueryInventoryCountDto) {
    const where: Prisma.InventoryCountWhereInput = {};
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.status) where.status = query.status;
    if (query.countType) where.countType = query.countType;
    if (query.search) {
      where.OR = [
        { countNumber: { contains: query.search, mode: 'insensitive' } },
        { notes: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.inventoryCount.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: COUNT_INCLUDE,
      }),
      this.prisma.inventoryCount.count({ where }),
    ]);

    return paginate(data, total, query.page, query.limit);
  }

  async findOne(id: string) {
    const count = await this.prisma.inventoryCount.findUnique({
      where: { id },
      include: {
        ...COUNT_INCLUDE,
        items: {
          include: {
            product: { select: { id: true, sku: true, name: true, uom: true, costPrice: true } },
            batch: { select: { id: true, batchNumber: true, expiryDate: true } },
            rack: { select: { id: true, rackCode: true, barcode: true } },
            countedBy: { select: { id: true, name: true } },
          },
          orderBy: { product: { name: 'asc' } },
        },
        approvals: {
          include: { performedBy: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!count) throw new NotFoundException(`Inventory count ${id} not found`);
    return count;
  }

  async create(dto: CreateInventoryCountDto, userId: string) {
    const countNumber = await this.generateCountNumber();

    const locationWhere: Prisma.InventoryLocationWhereInput = {
      warehouseId: dto.warehouseId,
    };

    if (dto.countType === InventoryCountType.CATEGORY && dto.categoryId) {
      locationWhere.product = { categoryId: dto.categoryId };
    } else if (dto.countType === InventoryCountType.PRODUCT && dto.productIds?.length) {
      locationWhere.productId = { in: dto.productIds };
    } else if (dto.countType === InventoryCountType.RACK && dto.rackIds?.length) {
      locationWhere.rackId = { in: dto.rackIds };
    }

    const locations = await this.prisma.inventoryLocation.findMany({
      where: locationWhere,
      include: { product: { select: { costPrice: true } } },
    });

    const count = await this.prisma.inventoryCount.create({
      data: {
        countNumber,
        warehouseId: dto.warehouseId,
        countType: dto.countType,
        status: InventoryCountStatus.DRAFT,
        countDate: new Date(dto.countDate),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        createdById: userId,
        notes: dto.notes,
        items: {
          create: locations.map((loc) => ({
            productId: loc.productId,
            batchId: loc.batchId,
            rackId: loc.rackId,
            systemQty: loc.quantity,
          })),
        },
      },
      include: COUNT_INCLUDE,
    });

    await this.auditService.log({
      entityType: 'InventoryCount',
      entityId: count.id,
      action: 'CREATE',
      newValue: { countNumber, status: count.status, countType: count.countType },
      performedById: userId,
    });

    return count;
  }

  async start(id: string, userId: string) {
    const count = await this.findOne(id);
    this.assertStatus(count.status, [InventoryCountStatus.DRAFT, InventoryCountStatus.RECOUNT]);

    const updated = await this.prisma.inventoryCount.update({
      where: { id },
      data: {
        status: InventoryCountStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
      include: COUNT_INCLUDE,
    });

    await this.auditService.log({
      entityType: 'InventoryCount',
      entityId: id,
      action: 'START',
      oldValue: { status: count.status },
      newValue: { status: InventoryCountStatus.IN_PROGRESS },
      performedById: userId,
    });

    return updated;
  }

  async submit(id: string, userId: string) {
    const count = await this.findOne(id);
    this.assertStatus(count.status, [InventoryCountStatus.IN_PROGRESS]);

    const [updated] = await this.prisma.$transaction([
      this.prisma.inventoryCount.update({
        where: { id },
        data: {
          status: InventoryCountStatus.SUBMITTED,
          submittedById: userId,
          submittedAt: new Date(),
        },
        include: COUNT_INCLUDE,
      }),
      this.prisma.approval.create({
        data: {
          inventoryCountId: id,
          action: ApprovalAction.SUBMIT,
          performedById: userId,
        },
      }),
    ]);

    await this.auditService.log({
      entityType: 'InventoryCount',
      entityId: id,
      action: 'SUBMIT',
      oldValue: { status: count.status },
      newValue: { status: InventoryCountStatus.SUBMITTED },
      performedById: userId,
    });

    return updated;
  }

  async approve(id: string, userId: string, remarks?: string) {
    const count = await this.findOne(id);
    this.assertStatus(count.status, [InventoryCountStatus.SUBMITTED]);

    // Update inventory locations with physical counts
    await this.applyPhysicalCounts(count);

    // Recalculate total variance
    const totalVariance = count.items.reduce((sum, item) => {
      return sum + (Number(item.varianceValue) || 0);
    }, 0);

    const [updated] = await this.prisma.$transaction([
      this.prisma.inventoryCount.update({
        where: { id },
        data: {
          status: InventoryCountStatus.APPROVED,
          approvedById: userId,
          approvedAt: new Date(),
          totalVarianceValue: totalVariance,
        },
        include: COUNT_INCLUDE,
      }),
      this.prisma.approval.create({
        data: {
          inventoryCountId: id,
          action: ApprovalAction.APPROVE,
          remarks,
          performedById: userId,
        },
      }),
    ]);

    await this.auditService.log({
      entityType: 'InventoryCount',
      entityId: id,
      action: 'APPROVE',
      oldValue: { status: count.status },
      newValue: { status: InventoryCountStatus.APPROVED, totalVarianceValue: totalVariance },
      performedById: userId,
    });

    return updated;
  }

  async reject(id: string, userId: string, remarks?: string) {
    const count = await this.findOne(id);
    this.assertStatus(count.status, [InventoryCountStatus.SUBMITTED]);

    const [updated] = await this.prisma.$transaction([
      this.prisma.inventoryCount.update({
        where: { id },
        data: { status: InventoryCountStatus.REJECTED },
        include: COUNT_INCLUDE,
      }),
      this.prisma.approval.create({
        data: {
          inventoryCountId: id,
          action: ApprovalAction.REJECT,
          remarks,
          performedById: userId,
        },
      }),
    ]);

    await this.auditService.log({
      entityType: 'InventoryCount',
      entityId: id,
      action: 'REJECT',
      oldValue: { status: count.status },
      newValue: { status: InventoryCountStatus.REJECTED },
      performedById: userId,
    });

    return updated;
  }

  async requestRecount(id: string, userId: string, remarks?: string) {
    const count = await this.findOne(id);
    this.assertStatus(count.status, [InventoryCountStatus.SUBMITTED]);

    const [updated] = await this.prisma.$transaction([
      this.prisma.inventoryCount.update({
        where: { id },
        data: { status: InventoryCountStatus.RECOUNT },
        include: COUNT_INCLUDE,
      }),
      this.prisma.approval.create({
        data: {
          inventoryCountId: id,
          action: ApprovalAction.RECOUNT,
          remarks,
          performedById: userId,
        },
      }),
    ]);

    await this.auditService.log({
      entityType: 'InventoryCount',
      entityId: id,
      action: 'RECOUNT',
      oldValue: { status: count.status },
      newValue: { status: InventoryCountStatus.RECOUNT },
      performedById: userId,
    });

    return updated;
  }

  private async applyPhysicalCounts(count: any) {
    for (const item of count.items) {
      if (item.physicalQty === null) continue;

      const existing = await this.prisma.inventoryLocation.findFirst({
        where: {
          warehouseId: count.warehouseId,
          rackId: item.rackId ?? null,
          productId: item.productId,
          batchId: item.batchId ?? null,
        },
      });

      if (existing) {
        await this.prisma.inventoryLocation.update({
          where: { id: existing.id },
          data: { quantity: item.physicalQty },
        });
      } else {
        await this.prisma.inventoryLocation.create({
          data: {
            warehouseId: count.warehouseId,
            rackId: item.rackId ?? null,
            productId: item.productId,
            batchId: item.batchId ?? null,
            quantity: item.physicalQty,
          },
        });
      }
    }
  }

  private assertStatus(current: InventoryCountStatus, allowed: InventoryCountStatus[]) {
    if (!allowed.includes(current)) {
      throw new BadRequestException(
        `Cannot perform this action on a count with status '${current}'. Allowed: ${allowed.join(', ')}`,
      );
    }
  }

  private async generateCountNumber(): Promise<string> {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');

    const todayStart = new Date(y, now.getMonth(), now.getDate());
    const todayCount = await this.prisma.inventoryCount.count({
      where: { createdAt: { gte: todayStart } },
    });

    const seq = String(todayCount + 1).padStart(4, '0');
    return `CNT-${y}${m}${d}-${seq}`;
  }
}
