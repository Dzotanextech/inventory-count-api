import { Injectable, NotFoundException, ConflictException, BadRequestException, HttpException, InternalServerErrorException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateRackDto } from './dto/create-rack.dto';
import { UpdateRackDto } from './dto/update-rack.dto';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';
import { v4 as uuidv4 } from 'uuid';

const RACK_ZONE_SQL = `
  SELECT r.*,
    json_build_object(
      'id', z.id, 'code', z.code, 'name', z.name,
      'warehouse', json_build_object('id', w.id, 'code', w.code, 'name', w.name)
    ) AS zone
  FROM racks r
  JOIN zones z ON z.id = r."zoneId"
  JOIN warehouses w ON w.id = z."warehouseId"
`;

@Injectable()
export class RacksService {
  private readonly logger = new Logger(RacksService.name);

  constructor(private db: DatabaseService) {}

  async findAll(query: PaginationDto & { zoneId?: string; warehouseId?: string }) {
    try {
      const params: any[] = [];
      const conditions: string[] = [];

      if (query.zoneId) { params.push(query.zoneId); conditions.push(`r."zoneId" = $${params.length}`); }
      if (query.warehouseId) { params.push(query.warehouseId); conditions.push(`z."warehouseId" = $${params.length}`); }
      if (query.search) {
        params.push(`%${query.search}%`);
        conditions.push(`(r."rackCode" ILIKE $${params.length} OR r.barcode ILIKE $${params.length})`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      params.push(query.limit, query.skip);
      const limitIdx = params.length - 1;
      const offsetIdx = params.length;

      const data = await this.db.query(`
        ${RACK_ZONE_SQL}
        ${where}
        ORDER BY r."rackCode" ASC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `, params);

      const countParams = params.slice(0, params.length - 2);
      const [{ count }] = await this.db.query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM racks r JOIN zones z ON z.id = r."zoneId" ${where}`,
        countParams,
      );

      return paginate(data, Number(count), query.page, query.limit);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException();
    }
  }

  async findOne(id: string) {
    try {
      const rack = await this.db.queryOne(`${RACK_ZONE_SQL} WHERE r.id = $1`, [id]);
      if (!rack) throw new NotFoundException(`Rack ${id} not found`);
      return rack;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException();
    }
  }

  async findByBarcode(barcode: string) {
    try {
      const rack = await this.db.queryOne(`SELECT * FROM racks WHERE barcode = $1`, [barcode]);
      if (!rack) throw new NotFoundException(`Rack with barcode '${barcode}' not found`);
      return rack;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException();
    }
  }

  async create(dto: CreateRackDto) {
    try {
      const codeConflict = await this.db.queryOne(
        `SELECT id FROM racks WHERE "zoneId" = $1 AND "rackCode" = $2`,
        [dto.zoneId, dto.rackCode],
      );
      if (codeConflict) throw new ConflictException(`Rack code '${dto.rackCode}' already exists in this zone`);

      const barcodeConflict = await this.db.queryOne(`SELECT id FROM racks WHERE barcode = $1`, [dto.barcode]);
      if (barcodeConflict) throw new ConflictException(`Barcode '${dto.barcode}' already in use`);

      const [row] = await this.db.query(`
        INSERT INTO racks (id, "zoneId", "rackCode", barcode, "binCount", "isActive")
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
      `, [uuidv4(), dto.zoneId, dto.rackCode, dto.barcode, dto.binCount ?? 1, dto.isActive ?? true]);

      return this.findOne(row.id);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException();
    }
  }

  async update(id: string, dto: UpdateRackDto) {
    try {
      const rack = await this.findOne(id) as any;

      if (dto.rackCode) {
        const dup = await this.db.queryOne(
          `SELECT id FROM racks WHERE "zoneId" = $1 AND "rackCode" = $2 AND id != $3`,
          [rack.zoneId, dto.rackCode, id],
        );
        if (dup) throw new ConflictException(`Rack code '${dto.rackCode}' already in use`);
      }

      if (dto.barcode) {
        const dup = await this.db.queryOne(`SELECT id FROM racks WHERE barcode = $1 AND id != $2`, [dto.barcode, id]);
        if (dup) throw new ConflictException(`Barcode '${dto.barcode}' already in use`);
      }

      const fields: string[] = [];
      const params: any[] = [];

      if (dto.rackCode) { params.push(dto.rackCode); fields.push(`"rackCode" = $${params.length}`); }
      if (dto.barcode) { params.push(dto.barcode); fields.push(`barcode = $${params.length}`); }
      if (dto.binCount !== undefined) { params.push(dto.binCount); fields.push(`"binCount" = $${params.length}`); }
      if (dto.isActive !== undefined) { params.push(dto.isActive); fields.push(`"isActive" = $${params.length}`); }

      if (fields.length === 0) return rack;

      params.push(id);
      await this.db.query(`UPDATE racks SET ${fields.join(', ')} WHERE id = $${params.length}`, params);
      return this.findOne(id);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException();
    }
  }

  async remove(id: string) {
    try {
      await this.findOne(id);
      const [row] = await this.db.query(`DELETE FROM racks WHERE id = $1 RETURNING *`, [id]);
      return row;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      if (error.code === '23503') throw new BadRequestException('Cannot delete rack — it has linked inventory records. Remove those first.');
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException();
    }
  }
}
