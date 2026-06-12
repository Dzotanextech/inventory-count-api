import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class WarehousesService {
  constructor(private db: DatabaseService) {}

  async findAll(query: PaginationDto) {
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
  }

  async findOne(id: string) {
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
  }

  async create(dto: CreateWarehouseDto) {
    const exists = await this.db.queryOne(`SELECT id FROM warehouses WHERE code = $1`, [dto.code]);
    if (exists) throw new ConflictException(`Warehouse code '${dto.code}' already exists`);

    const now = new Date();
    const [row] = await this.db.query(
      `INSERT INTO warehouses (id, code, name, address, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $5) RETURNING *`,
      [uuidv4(), dto.code, dto.name, dto.address, now],
    );
    return row;
  }

  async update(id: string, dto: UpdateWarehouseDto) {
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
  }

  async remove(id: string) {
    await this.findOne(id);
    try {
      const [row] = await this.db.query(`DELETE FROM warehouses WHERE id = $1 RETURNING *`, [id]);
      return row;
    } catch {
      throw new BadRequestException('Cannot delete warehouse — it has linked zones, racks, or inventory records. Remove those first.');
    }
  }
}
