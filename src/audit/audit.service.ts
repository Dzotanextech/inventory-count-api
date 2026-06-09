import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';

interface LogParams {
  entityType: string;
  entityId: string;
  action: string;
  oldValue?: any;
  newValue?: any;
  performedById: string;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(params: LogParams) {
    return this.prisma.auditLog.create({
      data: {
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        oldValue: params.oldValue ?? undefined,
        newValue: params.newValue ?? undefined,
        performedById: params.performedById,
      },
    });
  }

  async findAll(query: PaginationDto & { entityType?: string; entityId?: string }) {
    const where: any = {};
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: { performedBy: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return paginate(data, total, query.page, query.limit);
  }

  async findForEntity(entityType: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'asc' },
      include: { performedBy: { select: { id: true, name: true } } },
    });
  }
}
