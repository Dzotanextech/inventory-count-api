import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCountItemDto } from './dto/create-count-item.dto';
import { UpdateCountItemDto } from './dto/update-count-item.dto';
import { ScanProductDto } from './dto/scan-product.dto';
import { InventoryCountStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const ITEM_INCLUDE = {
  product: { select: { id: true, sku: true, name: true, uom: true, costPrice: true } },
  batch: { select: { id: true, batchNumber: true, expiryDate: true } },
  rack: { select: { id: true, rackCode: true, barcode: true } },
  countedBy: { select: { id: true, name: true } },
};

@Injectable()
export class InventoryCountItemsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findAll(inventoryCountId: string) {
    return this.prisma.inventoryCountItem.findMany({
      where: { inventoryCountId },
      include: ITEM_INCLUDE,
      orderBy: { product: { name: 'asc' } },
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.inventoryCountItem.findUnique({
      where: { id },
      include: ITEM_INCLUDE,
    });
    if (!item) throw new NotFoundException(`Count item ${id} not found`);
    return item;
  }

  async addItem(dto: CreateCountItemDto, userId: string) {
    const count = await this.prisma.inventoryCount.findUnique({
      where: { id: dto.inventoryCountId },
    });
    if (!count) throw new NotFoundException(`Inventory count not found`);
    if (count.status !== InventoryCountStatus.IN_PROGRESS) {
      throw new BadRequestException('Items can only be added to counts in IN_PROGRESS status');
    }

    return this.prisma.inventoryCountItem.create({
      data: {
        inventoryCountId: dto.inventoryCountId,
        productId: dto.productId,
        batchId: dto.batchId ?? null,
        rackId: dto.rackId ?? null,
        systemQty: dto.systemQty,
      },
      include: ITEM_INCLUDE,
    });
  }

  async updateItem(id: string, dto: UpdateCountItemDto, userId: string) {
    const item = await this.findOne(id);

    const count = await this.prisma.inventoryCount.findUnique({
      where: { id: item.inventoryCountId },
      include: { items: { include: { product: { select: { costPrice: true } } } } },
    });

    if (!count) throw new NotFoundException('Parent count not found');

    const allowedStatuses: InventoryCountStatus[] = [InventoryCountStatus.IN_PROGRESS, InventoryCountStatus.RECOUNT];
    if (!allowedStatuses.includes(count.status)) {
      throw new BadRequestException(
        `Cannot update items on a count with status '${count.status}'`,
      );
    }

    const systemQty = Number(item.systemQty);
    const physicalQty = Number(dto.physicalQty);
    const varianceQty = physicalQty - systemQty;
    const costPrice = Number(item.product.costPrice);
    const varianceValue = varianceQty * costPrice;

    const updated = await this.prisma.inventoryCountItem.update({
      where: { id },
      data: {
        physicalQty: dto.physicalQty,
        varianceQty: varianceQty.toString(),
        varianceValue: varianceValue.toFixed(2),
        reason: dto.reason,
        remarks: dto.remarks,
        countedById: userId,
        countedAt: new Date(),
      },
      include: ITEM_INCLUDE,
    });

    await this.auditService.log({
      entityType: 'InventoryCountItem',
      entityId: id,
      action: 'UPDATE_PHYSICAL_QTY',
      oldValue: { physicalQty: item.physicalQty, varianceQty: item.varianceQty },
      newValue: { physicalQty: dto.physicalQty, varianceQty, varianceValue },
      performedById: userId,
    });

    return updated;
  }

  async scan(dto: ScanProductDto, userId: string) {
    // Look up product by barcode
    const product = await this.prisma.product.findUnique({
      where: { barcode: dto.barcode },
    });

    if (!product) {
      throw new NotFoundException(`No product found with barcode '${dto.barcode}'`);
    }

    const count = await this.prisma.inventoryCount.findUnique({
      where: { id: dto.inventoryCountId },
    });

    if (!count) throw new NotFoundException('Inventory count not found');
    if (count.status !== InventoryCountStatus.IN_PROGRESS) {
      throw new BadRequestException('Scan is only allowed during IN_PROGRESS counts');
    }

    // Find existing item for this product in the count
    const existingItem = await this.prisma.inventoryCountItem.findFirst({
      where: {
        inventoryCountId: dto.inventoryCountId,
        productId: product.id,
        batchId: dto.batchId ?? null,
      },
    });

    const systemQty = Number(existingItem?.systemQty ?? 0);
    const physicalQty = Number(dto.physicalQty);
    const varianceQty = physicalQty - systemQty;
    const varianceValue = varianceQty * Number(product.costPrice);

    if (existingItem) {
      return this.prisma.inventoryCountItem.update({
        where: { id: existingItem.id },
        data: {
          physicalQty: dto.physicalQty,
          varianceQty: varianceQty.toString(),
          varianceValue: varianceValue.toFixed(2),
          remarks: dto.remarks,
          countedById: userId,
          countedAt: new Date(),
        },
        include: ITEM_INCLUDE,
      });
    }

    // Create new item if scanned product wasn't pre-loaded
    return this.prisma.inventoryCountItem.create({
      data: {
        inventoryCountId: dto.inventoryCountId,
        productId: product.id,
        batchId: dto.batchId ?? null,
        systemQty: 0,
        physicalQty: dto.physicalQty,
        varianceQty: varianceQty.toString(),
        varianceValue: varianceValue.toFixed(2),
        remarks: dto.remarks,
        countedById: userId,
        countedAt: new Date(),
      },
      include: ITEM_INCLUDE,
    });
  }
}
