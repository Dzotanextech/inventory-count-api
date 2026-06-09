import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInventoryLocationDto } from './dto/create-inventory-location.dto';
import { UpdateInventoryLocationDto } from './dto/update-inventory-location.dto';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';

const LOCATION_INCLUDE = {
  warehouse: { select: { id: true, code: true, name: true } },
  rack: { select: { id: true, rackCode: true, barcode: true } },
  product: { select: { id: true, sku: true, name: true, uom: true } },
  batch: { select: { id: true, batchNumber: true, expiryDate: true } },
};

@Injectable()
export class InventoryLocationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    query: PaginationDto & { warehouseId?: string; productId?: string; rackId?: string },
  ) {
    const where: any = {};
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.productId) where.productId = query.productId;
    if (query.rackId) where.rackId = query.rackId;

    const [data, total] = await Promise.all([
      this.prisma.inventoryLocation.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { product: { name: 'asc' } },
        include: LOCATION_INCLUDE,
      }),
      this.prisma.inventoryLocation.count({ where }),
    ]);

    return paginate(data, total, query.page, query.limit);
  }

  async findOne(id: string) {
    const loc = await this.prisma.inventoryLocation.findUnique({
      where: { id },
      include: LOCATION_INCLUDE,
    });
    if (!loc) throw new NotFoundException(`Inventory location ${id} not found`);
    return loc;
  }

  async upsert(dto: CreateInventoryLocationDto) {
    const existing = await this.prisma.inventoryLocation.findFirst({
      where: {
        warehouseId: dto.warehouseId,
        rackId: dto.rackId ?? null,
        productId: dto.productId,
        batchId: dto.batchId ?? null,
      },
    });

    if (existing) {
      return this.prisma.inventoryLocation.update({
        where: { id: existing.id },
        data: { quantity: dto.quantity },
        include: LOCATION_INCLUDE,
      });
    }

    return this.prisma.inventoryLocation.create({
      data: {
        warehouseId: dto.warehouseId,
        rackId: dto.rackId ?? null,
        productId: dto.productId,
        batchId: dto.batchId ?? null,
        quantity: dto.quantity,
      },
      include: LOCATION_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateInventoryLocationDto) {
    await this.findOne(id);
    return this.prisma.inventoryLocation.update({
      where: { id },
      data: { quantity: dto.quantity },
      include: LOCATION_INCLUDE,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.inventoryLocation.delete({ where: { id } });
  }

  async getStockSummary(warehouseId: string) {
    const locations = await this.prisma.inventoryLocation.findMany({
      where: { warehouseId },
      include: {
        product: { select: { id: true, sku: true, name: true, uom: true, costPrice: true } },
        batch: { select: { id: true, batchNumber: true, expiryDate: true } },
        rack: { select: { id: true, rackCode: true } },
      },
    });

    return locations;
  }
}
