import { Injectable, NotFoundException, ConflictException, BadRequestException, HttpException, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ZonesService {
  constructor(private db: DatabaseService) {}

  async findAll(query: PaginationDto & { warehouseId?: string }) {
    try {
      const params: any[] = [];
      const conditions: string[] = [];

      if (query.warehouseId) {
        params.push(query.warehouseId);
        conditions.push(`z."warehouseId" = $${params.length}`);
      }
      if (query.search) {
        params.push(`%${query.search}%`);
        conditions.push(`(z.name ILIKE $${params.length} OR z.code ILIKE $${params.length})`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      params.push(query.limit, query.skip);
      const limitIdx = params.length - 1;
      const offsetIdx = params.length;

      const data = await this.db.query(`
        SELECT z.*, COUNT(r.id)::int AS "rackCount",
               json_build_object('id', w.id, 'code', w.code, 'name', w.name) AS warehouse
        FROM zones z
        JOIN warehouses w ON w.id = z."warehouseId"
        LEFT JOIN racks r ON r."zoneId" = z.id
        ${where}
        GROUP BY z.id, w.id
        ORDER BY z.code ASC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `, params);

      const countParams = params.slice(0, params.length - 2);
      const [{ count }] = await this.db.query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM zones z ${where}`,
        countParams,
      );

      const shaped = data.map((r) => ({ ...r, _count: { racks: r.rackCount }, rackCount: undefined }));
      return paginate(shaped, Number(count), query.page, query.limit);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }

  async findOne(id: string) {
    try {
      const zone = await this.db.queryOne<any>(`
        SELECT z.*,
               json_build_object('id', w.id, 'code', w.code, 'name', w.name) AS warehouse
        FROM zones z
        JOIN warehouses w ON w.id = z."warehouseId"
        WHERE z.id = $1
      `, [id]);
      if (!zone) throw new NotFoundException(`Zone ${id} not found`);

      const racks = await this.db.query(`SELECT * FROM racks WHERE "zoneId" = $1`, [id]);
      return { ...zone, racks };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }

  async create(dto: CreateZoneDto) {
    try {
      const dup = await this.db.queryOne(
        `SELECT id FROM zones WHERE "warehouseId" = $1 AND code = $2`,
        [dto.warehouseId, dto.code],
      );
      if (dup) throw new ConflictException(`Zone code '${dto.code}' already exists in this warehouse`);

      const [row] = await this.db.query(`
        INSERT INTO zones (id, "warehouseId", code, name)
        VALUES ($1, $2, $3, $4) RETURNING *
      `, [uuidv4(), dto.warehouseId, dto.code, dto.name]);

      return this.findOne(row.id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }

  async update(id: string, dto: UpdateZoneDto) {
    try {
      const zone = await this.findOne(id);

      if (dto.code) {
        const dup = await this.db.queryOne(
          `SELECT id FROM zones WHERE "warehouseId" = $1 AND code = $2 AND id != $3`,
          [(zone as any).warehouseId, dto.code, id],
        );
        if (dup) throw new ConflictException(`Zone code '${dto.code}' already in use`);
      }

      const fields: string[] = [];
      const params: any[] = [];

      if (dto.code) { params.push(dto.code); fields.push(`code = $${params.length}`); }
      if (dto.name) { params.push(dto.name); fields.push(`name = $${params.length}`); }

      if (fields.length === 0) return zone;

      params.push(id);
      await this.db.query(`UPDATE zones SET ${fields.join(', ')} WHERE id = $${params.length}`, params);
      return this.findOne(id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }

  async remove(id: string) {
    try {
      await this.findOne(id);
      const [row] = await this.db.query(`DELETE FROM zones WHERE id = $1 RETURNING *`, [id]);
      return row;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if ((error as any).code === '23503') throw new BadRequestException('Cannot delete zone — it has linked racks. Remove those first.');
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }
}
