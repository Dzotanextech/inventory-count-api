import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRackDto } from './dto/create-rack.dto';
import { UpdateRackDto } from './dto/update-rack.dto';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';

@Injectable()
export class RacksService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: PaginationDto & { zoneId?: string; warehouseId?: string }) {
    const where: any = {};
    if (query.zoneId) where.zoneId = query.zoneId;
    if (query.warehouseId) where.zone = { warehouseId: query.warehouseId };
    if (query.search) {
      where.OR = [
        { rackCode: { contains: query.search, mode: 'insensitive' } },
        { barcode: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.rack.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { rackCode: 'asc' },
        include: {
          zone: {
            select: {
              id: true,
              code: true,
              name: true,
              warehouse: { select: { id: true, code: true, name: true } },
            },
          },
        },
      }),
      this.prisma.rack.count({ where }),
    ]);

    return paginate(data, total, query.page, query.limit);
  }

  async findOne(id: string) {
    const rack = await this.prisma.rack.findUnique({
      where: { id },
      include: {
        zone: {
          include: { warehouse: { select: { id: true, code: true, name: true } } },
        },
      },
    });
    if (!rack) throw new NotFoundException(`Rack ${id} not found`);
    return rack;
  }

  async findByBarcode(barcode: string) {
    const rack = await this.prisma.rack.findUnique({ where: { barcode } });
    if (!rack) throw new NotFoundException(`Rack with barcode '${barcode}' not found`);
    return rack;
  }

  async create(dto: CreateRackDto) {
    const codeConflict = await this.prisma.rack.findUnique({
      where: { zoneId_rackCode: { zoneId: dto.zoneId, rackCode: dto.rackCode } },
    });
    if (codeConflict) throw new ConflictException(`Rack code '${dto.rackCode}' already exists in this zone`);

    const barcodeConflict = await this.prisma.rack.findUnique({ where: { barcode: dto.barcode } });
    if (barcodeConflict) throw new ConflictException(`Barcode '${dto.barcode}' already in use`);

    return this.prisma.rack.create({
      data: {
        zoneId: dto.zoneId,
        rackCode: dto.rackCode,
        barcode: dto.barcode,
        binCount: dto.binCount ?? 1,
        isActive: dto.isActive ?? true,
      },
      include: { zone: { select: { id: true, code: true, name: true } } },
    });
  }

  async update(id: string, dto: UpdateRackDto) {
    const rack = await this.findOne(id);

    if (dto.rackCode) {
      const dup = await this.prisma.rack.findFirst({
        where: { zoneId: rack.zoneId, rackCode: dto.rackCode, NOT: { id } },
      });
      if (dup) throw new ConflictException(`Rack code '${dto.rackCode}' already in use`);
    }

    if (dto.barcode) {
      const dup = await this.prisma.rack.findFirst({
        where: { barcode: dto.barcode, NOT: { id } },
      });
      if (dup) throw new ConflictException(`Barcode '${dto.barcode}' already in use`);
    }

    return this.prisma.rack.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    try {
      return await this.prisma.rack.delete({ where: { id } });
    } catch {
      throw new BadRequestException('Cannot delete rack — it has linked inventory records. Remove those first.');
    }
  }
}
