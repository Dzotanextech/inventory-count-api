import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';

@Injectable()
export class WarehousesService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: PaginationDto) {
    const where = query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' as const } },
            { code: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.warehouse.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { name: 'asc' },
        include: { _count: { select: { zones: true } } },
      }),
      this.prisma.warehouse.count({ where }),
    ]);

    return paginate(data, total, query.page, query.limit);
  }

  async findOne(id: string) {
    const wh = await this.prisma.warehouse.findUnique({
      where: { id },
      include: { zones: { include: { racks: true } } },
    });
    if (!wh) throw new NotFoundException(`Warehouse ${id} not found`);
    return wh;
  }

  async create(dto: CreateWarehouseDto) {
    const exists = await this.prisma.warehouse.findUnique({ where: { code: dto.code } });
    if (exists) throw new ConflictException(`Warehouse code '${dto.code}' already exists`);
    return this.prisma.warehouse.create({ data: dto });
  }

  async update(id: string, dto: UpdateWarehouseDto) {
    await this.findOne(id);
    if (dto.code) {
      const dup = await this.prisma.warehouse.findFirst({
        where: { code: dto.code, NOT: { id } },
      });
      if (dup) throw new ConflictException(`Code '${dto.code}' already in use`);
    }
    return this.prisma.warehouse.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    try {
      return await this.prisma.warehouse.delete({ where: { id } });
    } catch {
      throw new BadRequestException('Cannot delete warehouse — it has linked zones, racks, or inventory records. Remove those first.');
    }
  }
}
