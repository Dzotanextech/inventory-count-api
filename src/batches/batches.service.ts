import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateBatchDto } from './dto/create-batch.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';
import { v4 as uuidv4 } from 'uuid';

const BATCH_SQL = `
  SELECT b.*,
    json_build_object('id', p.id, 'sku', p.sku, 'name', p.name) AS product
  FROM batches b
  JOIN products p ON p.id = b."productId"
`;

@Injectable()
export class BatchesService {
  constructor(private db: DatabaseService) {}

  async findAll(query: PaginationDto & { productId?: string }) {
    const params: any[] = [];
    const conditions: string[] = [];

    if (query.productId) { params.push(query.productId); conditions.push(`b."productId" = $${params.length}`); }
    if (query.search) {
      params.push(`%${query.search}%`);
      conditions.push(`b."batchNumber" ILIKE $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(query.limit, query.skip);
    const limitIdx = params.length - 1;
    const offsetIdx = params.length;

    const data = await this.db.query(
      `${BATCH_SQL} ${where} ORDER BY b."batchNumber" ASC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    );

    const countParams = params.slice(0, params.length - 2);
    const [{ count }] = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM batches b ${where}`,
      countParams,
    );

    return paginate(data, Number(count), query.page, query.limit);
  }

  async findOne(id: string) {
    const batch = await this.db.queryOne(`${BATCH_SQL} WHERE b.id = $1`, [id]);
    if (!batch) throw new NotFoundException(`Batch ${id} not found`);
    return batch;
  }

  async create(dto: CreateBatchDto) {
    const dup = await this.db.queryOne(
      `SELECT id FROM batches WHERE "productId" = $1 AND "batchNumber" = $2`,
      [dto.productId, dto.batchNumber],
    );
    if (dup) throw new ConflictException(`Batch '${dto.batchNumber}' already exists for this product`);

    const [row] = await this.db.query(`
      INSERT INTO batches (id, "productId", "batchNumber", "manufacturingDate", "expiryDate")
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [
      uuidv4(), dto.productId, dto.batchNumber,
      dto.manufacturingDate ? new Date(dto.manufacturingDate) : null,
      dto.expiryDate ? new Date(dto.expiryDate) : null,
    ]);

    return this.findOne(row.id);
  }

  async update(id: string, dto: UpdateBatchDto) {
    const batch = await this.findOne(id) as any;

    if (dto.batchNumber) {
      const dup = await this.db.queryOne(
        `SELECT id FROM batches WHERE "productId" = $1 AND "batchNumber" = $2 AND id != $3`,
        [batch.productId, dto.batchNumber, id],
      );
      if (dup) throw new ConflictException(`Batch number '${dto.batchNumber}' already in use`);
    }

    const fields: string[] = [];
    const params: any[] = [];

    if (dto.batchNumber) { params.push(dto.batchNumber); fields.push(`"batchNumber" = $${params.length}`); }
    if (dto.manufacturingDate !== undefined) {
      params.push(dto.manufacturingDate ? new Date(dto.manufacturingDate) : null);
      fields.push(`"manufacturingDate" = $${params.length}`);
    }
    if (dto.expiryDate !== undefined) {
      params.push(dto.expiryDate ? new Date(dto.expiryDate) : null);
      fields.push(`"expiryDate" = $${params.length}`);
    }

    if (fields.length === 0) return batch;

    params.push(id);
    await this.db.query(`UPDATE batches SET ${fields.join(', ')} WHERE id = $${params.length}`, params);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    const [row] = await this.db.query(`DELETE FROM batches WHERE id = $1 RETURNING *`, [id]);
    return row;
  }
}
