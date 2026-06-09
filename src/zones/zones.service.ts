import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';

@Injectable()
export class ZonesService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: PaginationDto & { warehouseId?: string }) {
    const where: any = {};
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.zone.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { code: 'asc' },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          _count: { select: { racks: true } },
        },
      }),
      this.prisma.zone.count({ where }),
    ]);

    return paginate(data, total, query.page, query.limit);
  }

  async findOne(id: string) {
    const zone = await this.prisma.zone.findUnique({
      where: { id },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        racks: true,
      },
    });
    if (!zone) throw new NotFoundException(`Zone ${id} not found`);
    return zone;
  }

  async create(dto: CreateZoneDto) {
    const dup = await this.prisma.zone.findUnique({
      where: { warehouseId_code: { warehouseId: dto.warehouseId, code: dto.code } },
    });
    if (dup) throw new ConflictException(`Zone code '${dto.code}' already exists in this warehouse`);

    return this.prisma.zone.create({
      data: dto,
      include: { warehouse: { select: { id: true, code: true, name: true } } },
    });
  }

  async update(id: string, dto: UpdateZoneDto) {
    const zone = await this.findOne(id);
    if (dto.code) {
      const dup = await this.prisma.zone.findFirst({
        where: { warehouseId: zone.warehouseId, code: dto.code, NOT: { id } },
      });
      if (dup) throw new ConflictException(`Zone code '${dto.code}' already in use`);
    }
    return this.prisma.zone.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    try {
      return await this.prisma.zone.delete({ where: { id } });
    } catch {
      throw new BadRequestException('Cannot delete zone — it has linked racks. Remove those first.');
    }
  }
}
