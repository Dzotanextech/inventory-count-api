import { Injectable, NotFoundException, BadRequestException, HttpException, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../audit/audit.service';
import { CreateCountItemDto } from './dto/create-count-item.dto';
import { UpdateCountItemDto } from './dto/update-count-item.dto';
import { ScanProductDto } from './dto/scan-product.dto';
import { InventoryCountStatus } from '../common/enums';
import { v4 as uuidv4 } from 'uuid';

const ITEM_SQL = `
  SELECT ici.*,
    json_build_object('id', p.id, 'sku', p.sku, 'name', p.name, 'uom', p.uom, 'costPrice', p."costPrice") AS product,
    CASE WHEN b.id IS NOT NULL THEN json_build_object('id', b.id, 'batchNumber', b."batchNumber", 'expiryDate', b."expiryDate") END AS batch,
    CASE WHEN r.id IS NOT NULL THEN json_build_object('id', r.id, 'rackCode', r."rackCode", 'barcode', r.barcode) END AS rack,
    CASE WHEN u.id IS NOT NULL THEN json_build_object('id', u.id, 'name', u.name) END AS "countedBy"
  FROM inventory_count_items ici
  JOIN products p ON p.id = ici."productId"
  LEFT JOIN batches b ON b.id = ici."batchId"
  LEFT JOIN racks r ON r.id = ici."rackId"
  LEFT JOIN users u ON u.id = ici."countedById"
`;

@Injectable()
export class InventoryCountItemsService {
  constructor(
    private db: DatabaseService,
    private auditService: AuditService,
  ) {}

  async findAll(inventoryCountId: string) {
    try {
      return await this.db.query(`${ITEM_SQL} WHERE ici."inventoryCountId" = $1 ORDER BY p.name ASC`, [inventoryCountId]);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }

  async findOne(id: string) {
    try {
      const item = await this.db.queryOne(`${ITEM_SQL} WHERE ici.id = $1`, [id]);
      if (!item) throw new NotFoundException(`Count item ${id} not found`);
      return item;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }

  async addItem(dto: CreateCountItemDto, userId: string) {
    try {
      const count = await this.db.queryOne<any>(`SELECT * FROM inventory_counts WHERE id = $1`, [dto.inventoryCountId]);
      if (!count) throw new NotFoundException(`Inventory count not found`);
      if (count.status !== InventoryCountStatus.IN_PROGRESS) {
        throw new BadRequestException('Items can only be added to counts in IN_PROGRESS status');
      }

      const [row] = await this.db.query(`
        INSERT INTO inventory_count_items (id, "inventoryCountId", "productId", "batchId", "rackId", "systemQty")
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
      `, [uuidv4(), dto.inventoryCountId, dto.productId, dto.batchId ?? null, dto.rackId ?? null, dto.systemQty]);

      return this.findOne(row.id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }

  async updateItem(id: string, dto: UpdateCountItemDto, userId: string) {
    try {
      const item = await this.findOne(id) as any;

      const count = await this.db.queryOne<any>(`SELECT * FROM inventory_counts WHERE id = $1`, [item.inventoryCountId]);
      if (!count) throw new NotFoundException('Parent count not found');

      const allowedStatuses = [InventoryCountStatus.IN_PROGRESS, InventoryCountStatus.RECOUNT];
      if (!allowedStatuses.includes(count.status)) {
        throw new BadRequestException(`Cannot update items on a count with status '${count.status}'`);
      }

      const systemQty = Number(item.systemQty);
      const physicalQty = Number(dto.physicalQty);
      const varianceQty = physicalQty - systemQty;
      const costPrice = Number(item.product.costPrice);
      const varianceValue = varianceQty * costPrice;

      await this.db.query(`
        UPDATE inventory_count_items
        SET "physicalQty" = $1, "varianceQty" = $2, "varianceValue" = $3,
            reason = $4, remarks = $5, "countedById" = $6, "countedAt" = NOW()
        WHERE id = $7
      `, [dto.physicalQty, varianceQty.toString(), varianceValue.toFixed(2),
          dto.reason ?? null, dto.remarks ?? null, userId, id]);

      await this.auditService.log({
        entityType: 'InventoryCountItem', entityId: id, action: 'UPDATE_PHYSICAL_QTY',
        oldValue: { physicalQty: item.physicalQty, varianceQty: item.varianceQty },
        newValue: { physicalQty: dto.physicalQty, varianceQty, varianceValue },
        performedById: userId,
      });

      return this.findOne(id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }

  async scan(dto: ScanProductDto, userId: string) {
    try {
      const product = await this.db.queryOne<any>(`SELECT * FROM products WHERE barcode = $1`, [dto.barcode]);
      if (!product) throw new NotFoundException(`No product found with barcode '${dto.barcode}'`);

      const count = await this.db.queryOne<any>(`SELECT * FROM inventory_counts WHERE id = $1`, [dto.inventoryCountId]);
      if (!count) throw new NotFoundException('Inventory count not found');
      if (count.status !== InventoryCountStatus.IN_PROGRESS) {
        throw new BadRequestException('Scan is only allowed during IN_PROGRESS counts');
      }

      const existingItem = await this.db.queryOne<any>(`
        SELECT * FROM inventory_count_items
        WHERE "inventoryCountId" = $1 AND "productId" = $2
          AND ("batchId" = $3 OR ($3 IS NULL AND "batchId" IS NULL))
      `, [dto.inventoryCountId, product.id, dto.batchId ?? null]);

      const systemQty = Number(existingItem?.systemQty ?? 0);
      const physicalQty = Number(dto.physicalQty);
      const varianceQty = physicalQty - systemQty;
      const varianceValue = varianceQty * Number(product.costPrice);

      if (existingItem) {
        await this.db.query(`
          UPDATE inventory_count_items
          SET "physicalQty" = $1, "varianceQty" = $2, "varianceValue" = $3,
              remarks = $4, "countedById" = $5, "countedAt" = NOW()
          WHERE id = $6
        `, [dto.physicalQty, varianceQty.toString(), varianceValue.toFixed(2),
            dto.remarks ?? null, userId, existingItem.id]);

        return this.findOne(existingItem.id);
      }

      const [row] = await this.db.query(`
        INSERT INTO inventory_count_items
          (id, "inventoryCountId", "productId", "batchId", "systemQty", "physicalQty", "varianceQty", "varianceValue", remarks, "countedById", "countedAt")
        VALUES ($1,$2,$3,$4,0,$5,$6,$7,$8,$9,NOW()) RETURNING *
      `, [uuidv4(), dto.inventoryCountId, product.id, dto.batchId ?? null,
          dto.physicalQty, varianceQty.toString(), varianceValue.toFixed(2),
          dto.remarks ?? null, userId]);

      return this.findOne(row.id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }
}
