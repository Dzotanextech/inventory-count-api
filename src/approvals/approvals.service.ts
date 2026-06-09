import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';

@Injectable()
export class ApprovalsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: PaginationDto & { inventoryCountId?: string }) {
    const where: any = {};
    if (query.inventoryCountId) where.inventoryCountId = query.inventoryCountId;

    const [data, total] = await Promise.all([
      this.prisma.approval.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          performedBy: { select: { id: true, name: true, email: true } },
          inventoryCount: { select: { id: true, countNumber: true, status: true } },
        },
      }),
      this.prisma.approval.count({ where }),
    ]);

    return paginate(data, total, query.page, query.limit);
  }

  async findOne(id: string) {
    const approval = await this.prisma.approval.findUnique({
      where: { id },
      include: {
        performedBy: { select: { id: true, name: true, email: true } },
        inventoryCount: { select: { id: true, countNumber: true, status: true } },
      },
    });
    if (!approval) throw new NotFoundException(`Approval ${id} not found`);
    return approval;
  }

  async findByCount(inventoryCountId: string) {
    return this.prisma.approval.findMany({
      where: { inventoryCountId },
      orderBy: { createdAt: 'asc' },
      include: { performedBy: { select: { id: true, name: true } } },
    });
  }
}
