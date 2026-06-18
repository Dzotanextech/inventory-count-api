import { Injectable, NotFoundException, ConflictException, BadRequestException, HttpException, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CategoriesService {
  constructor(private db: DatabaseService) {}

  async findAll(query: PaginationDto) {
    try {
      const params: any[] = [];
      let where = '';

      if (query.search) {
        params.push(`%${query.search}%`);
        where = `WHERE c.name ILIKE $${params.length}`;
      }

      params.push(query.limit, query.skip);
      const limitIdx = params.length - 1;
      const offsetIdx = params.length;

      const data = await this.db.query(`
        SELECT c.id, c.name, COUNT(p.id)::int AS "productCount"
        FROM categories c
        LEFT JOIN products p ON p."categoryId" = c.id
        ${where}
        GROUP BY c.id
        ORDER BY c.name ASC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `, params);

      const countParams = query.search ? [`%${query.search}%`] : [];
      const countWhere = query.search ? `WHERE name ILIKE $1` : '';
      const [{ count }] = await this.db.query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM categories ${countWhere}`,
        countParams,
      );

      const shaped = data.map((r) => ({ id: r.id, name: r.name, _count: { products: r.productCount } }));
      return paginate(shaped, Number(count), query.page, query.limit);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }

  async findOne(id: string) {
    try {
      const row = await this.db.queryOne<any>(`
        SELECT c.id, c.name, COUNT(p.id)::int AS "productCount"
        FROM categories c
        LEFT JOIN products p ON p."categoryId" = c.id
        WHERE c.id = $1
        GROUP BY c.id
      `, [id]);

      if (!row) throw new NotFoundException(`Category ${id} not found`);
      return { id: row.id, name: row.name, _count: { products: row.productCount } };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }

  async create(dto: CreateCategoryDto) {
    try {
      const exists = await this.db.queryOne(`SELECT id FROM categories WHERE name = $1`, [dto.name]);
      if (exists) throw new ConflictException(`Category '${dto.name}' already exists`);

      const [row] = await this.db.query(
        `INSERT INTO categories (id, name) VALUES ($1, $2) RETURNING *`,
        [uuidv4(), dto.name],
      );
      return row;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }

  async update(id: string, dto: Partial<CreateCategoryDto>) {
    try {
      await this.findOne(id);

      if (dto.name) {
        const dup = await this.db.queryOne(`SELECT id FROM categories WHERE name = $1 AND id != $2`, [dto.name, id]);
        if (dup) throw new ConflictException(`Category '${dto.name}' already exists`);
      }

      const [row] = await this.db.query(
        `UPDATE categories SET name = $1 WHERE id = $2 RETURNING *`,
        [dto.name, id],
      );
      return row;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }

  async remove(id: string) {
    try {
      await this.findOne(id);
      const [row] = await this.db.query(`DELETE FROM categories WHERE id = $1 RETURNING *`, [id]);
      return row;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if ((error as any).code === '23503') throw new BadRequestException('Cannot delete category — it has linked products. Remove those first.');
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }
}
