import { Injectable, NotFoundException, HttpException, InternalServerErrorException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateInventoryLocationDto } from './dto/create-inventory-location.dto';
import { UpdateInventoryLocationDto } from './dto/update-inventory-location.dto';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';
import { v4 as uuidv4 } from 'uuid';

const LOCATION_SQL = `
  SELECT il.*,
    json_build_object('id', w.id, 'code', w.code, 'name', w.name) AS warehouse,
    CASE WHEN r.id IS NOT NULL THEN json_build_object('id', r.id, 'rackCode', r."rackCode", 'barcode', r.barcode) END AS rack,
    json_build_object('id', p.id, 'sku', p.sku, 'name', p.name, 'uom', p.uom) AS product,
    CASE WHEN b.id IS NOT NULL THEN json_build_object('id', b.id, 'batchNumber', b."batchNumber", 'expiryDate', b."expiryDate") END AS batch
  FROM inventory_locations il
  JOIN warehouses w ON w.id = il."warehouseId"
  LEFT JOIN racks r ON r.id = il."rackId"
  JOIN products p ON p.id = il."productId"
  LEFT JOIN batches b ON b.id = il."batchId"
`;

@Injectable()
export class InventoryLocationsService {
  private readonly logger = new Logger(InventoryLocationsService.name);

  constructor(private db: DatabaseService) {}

  async findAll(query: PaginationDto & { warehouseId?: string; productId?: string; rackId?: string }) {
    try {
      const params: any[] = [];
      const conditions: string[] = [];

      if (query.warehouseId) { params.push(query.warehouseId); conditions.push(`il."warehouseId" = $${params.length}`); }
      if (query.productId) { params.push(query.productId); conditions.push(`il."productId" = $${params.length}`); }
      if (query.rackId) { params.push(query.rackId); conditions.push(`il."rackId" = $${params.length}`); }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      params.push(query.limit, query.skip);
      const limitIdx = params.length - 1;
      const offsetIdx = params.length;

      const data = await this.db.query(
        `${LOCATION_SQL} ${where} ORDER BY p.name ASC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        params,
      );

      const countParams = params.slice(0, params.length - 2);
      const [{ count }] = await this.db.query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM inventory_locations il ${where}`,
        countParams,
      );

      return paginate(data, Number(count), query.page, query.limit);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  async findOne(id: string) {
    try {
      const loc = await this.db.queryOne(`${LOCATION_SQL} WHERE il.id = $1`, [id]);
      if (!loc) throw new NotFoundException(`Inventory location ${id} not found`);
      return loc;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  async upsert(dto: CreateInventoryLocationDto) {
    try {
      const existing = await this.db.queryOne<any>(`
        SELECT id FROM inventory_locations
        WHERE "warehouseId" = $1
          AND ("rackId" = $2 OR ($2 IS NULL AND "rackId" IS NULL))
          AND "productId" = $3
          AND ("batchId" = $4 OR ($4 IS NULL AND "batchId" IS NULL))
      `, [dto.warehouseId, dto.rackId ?? null, dto.productId, dto.batchId ?? null]);

      if (existing) {
        await this.db.query(`UPDATE inventory_locations SET quantity = $1 WHERE id = $2`, [dto.quantity, existing.id]);
        return this.findOne(existing.id);
      }

      const [row] = await this.db.query(`
        INSERT INTO inventory_locations (id, "warehouseId", "rackId", "productId", "batchId", quantity)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
      `, [uuidv4(), dto.warehouseId, dto.rackId ?? null, dto.productId, dto.batchId ?? null, dto.quantity]);

      return this.findOne(row.id);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  async update(id: string, dto: UpdateInventoryLocationDto) {
    try {
      await this.findOne(id);
      await this.db.query(`UPDATE inventory_locations SET quantity = $1 WHERE id = $2`, [dto.quantity, id]);
      return this.findOne(id);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  async remove(id: string) {
    try {
      await this.findOne(id);
      const [row] = await this.db.query(`DELETE FROM inventory_locations WHERE id = $1 RETURNING *`, [id]);
      return row;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  async getStockSummary(warehouseId: string) {
    try {
      return await this.db.query(`
        SELECT il.*,
          json_build_object('id', p.id, 'sku', p.sku, 'name', p.name, 'uom', p.uom, 'costPrice', p."costPrice") AS product,
          CASE WHEN b.id IS NOT NULL THEN json_build_object('id', b.id, 'batchNumber', b."batchNumber", 'expiryDate', b."expiryDate") END AS batch,
          CASE WHEN r.id IS NOT NULL THEN json_build_object('id', r.id, 'rackCode', r."rackCode") END AS rack
        FROM inventory_locations il
        JOIN products p ON p.id = il."productId"
        LEFT JOIN batches b ON b.id = il."batchId"
        LEFT JOIN racks r ON r.id = il."rackId"
        WHERE il."warehouseId" = $1
      `, [warehouseId]);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }
}
