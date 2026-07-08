import { Injectable, NotFoundException, ConflictException, BadRequestException, HttpException, InternalServerErrorException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class WarehousesService {
  private readonly logger = new Logger(WarehousesService.name);

  constructor(private db: DatabaseService) {}

  async findAll(query: PaginationDto) {
    try {
      const params: any[] = [];
      let where = '';

      if (query.search) {
        params.push(`%${query.search}%`);
        where = `WHERE w.name ILIKE $1 OR w.code ILIKE $1`;
      }

      params.push(query.limit, query.skip);
      const limitIdx = params.length - 1;
      const offsetIdx = params.length;

      const data = await this.db.query(`
        SELECT w.*, COUNT(z.id)::int AS "zoneCount"
        FROM warehouses w
        LEFT JOIN zones z ON z."warehouseId" = w.id
        ${where}
        GROUP BY w.id
        ORDER BY w.name ASC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `, params);

      const countParams = query.search ? [`%${query.search}%`] : [];
      const countWhere = query.search ? `WHERE name ILIKE $1 OR code ILIKE $1` : '';
      const [{ count }] = await this.db.query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM warehouses ${countWhere}`,
        countParams,
      );

      const shaped = data.map((r) => ({ ...r, _count: { zones: r.zoneCount }, zoneCount: undefined }));
      return paginate(shaped, Number(count), query.page, query.limit);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException();
    }
  }

  async findOne(id: string) {
    try {
      const wh = await this.db.queryOne<any>(`SELECT * FROM warehouses WHERE id = $1`, [id]);
      if (!wh) throw new NotFoundException(`Warehouse ${id} not found`);

      const zones = await this.db.query(`
        SELECT z.*, json_agg(r.*) FILTER (WHERE r.id IS NOT NULL) AS racks
        FROM zones z
        LEFT JOIN racks r ON r."zoneId" = z.id
        WHERE z."warehouseId" = $1
        GROUP BY z.id
        ORDER BY z.code ASC
      `, [id]);

      return { ...wh, zones };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException();
    }
  }

  async create(dto: CreateWarehouseDto) {
    try {
      const exists = await this.db.queryOne(`SELECT id FROM warehouses WHERE code = $1`, [dto.code]);
      if (exists) throw new ConflictException(`Warehouse code '${dto.code}' already exists`);

      const now = new Date();
      const [row] = await this.db.query(
        `INSERT INTO warehouses (id, code, name, address, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $5) RETURNING *`,
        [uuidv4(), dto.code, dto.name, dto.address, now],
      );
      return row;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException();
    }
  }

  async update(id: string, dto: UpdateWarehouseDto) {
    try {
      await this.findOne(id);

      if (dto.code) {
        const dup = await this.db.queryOne(`SELECT id FROM warehouses WHERE code = $1 AND id != $2`, [dto.code, id]);
        if (dup) throw new ConflictException(`Code '${dto.code}' already in use`);
      }

      const fields: string[] = ['"updatedAt" = NOW()'];
      const params: any[] = [];

      if (dto.code) { params.push(dto.code); fields.push(`code = $${params.length}`); }
      if (dto.name) { params.push(dto.name); fields.push(`name = $${params.length}`); }
      if (dto.address) { params.push(dto.address); fields.push(`address = $${params.length}`); }

      params.push(id);
      const [row] = await this.db.query(
        `UPDATE warehouses SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING *`,
        params,
      );
      return row;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException();
    }
  }

  async remove(id: string) {
    try {
      await this.findOne(id);
      const [row] = await this.db.query(`DELETE FROM warehouses WHERE id = $1 RETURNING *`, [id]);
      return row;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      if (error.code === '23503') throw new BadRequestException('Cannot delete warehouse — it has linked zones, racks, or inventory records. Remove those first.');
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException();
    }
  }
}
