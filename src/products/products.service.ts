import { Injectable, NotFoundException, ConflictException, BadRequestException, HttpException, InternalServerErrorException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';
import { v4 as uuidv4 } from 'uuid';

const PRODUCT_SQL = `
  SELECT p.*,
    json_build_object('id', c.id, 'name', c.name) AS category
  FROM products p
  JOIN categories c ON c.id = p."categoryId"
`;

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(private db: DatabaseService) {}

  async findAll(query: PaginationDto & { categoryId?: string }) {
    try {
      const params: any[] = [];
      const conditions: string[] = [];

      if (query.categoryId) { params.push(query.categoryId); conditions.push(`p."categoryId" = $${params.length}`); }
      if (query.search) {
        params.push(`%${query.search}%`);
        conditions.push(`(p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR p.barcode ILIKE $${params.length})`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      params.push(query.limit, query.skip);
      const limitIdx = params.length - 1;
      const offsetIdx = params.length;

      const data = await this.db.query(`${PRODUCT_SQL} ${where} ORDER BY p.name ASC LIMIT $${limitIdx} OFFSET $${offsetIdx}`, params);

      const countParams = params.slice(0, params.length - 2);
      const [{ count }] = await this.db.query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM products p ${where}`,
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
      const product = await this.db.queryOne<any>(`${PRODUCT_SQL} WHERE p.id = $1`, [id]);
      if (!product) throw new NotFoundException(`Product ${id} not found`);

      const batches = await this.db.query(`SELECT * FROM batches WHERE "productId" = $1`, [id]);
      return { ...product, batches };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException();
    }
  }

  async findByBarcode(barcode: string) {
    try {
      const product = await this.db.queryOne<any>(`${PRODUCT_SQL} WHERE p.barcode = $1`, [barcode]);
      if (!product) throw new NotFoundException(`Product with barcode '${barcode}' not found`);

      const batches = await this.db.query(`SELECT * FROM batches WHERE "productId" = $1`, [product.id]);
      return { ...product, batches };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException();
    }
  }

  async create(dto: CreateProductDto) {
    try {
      const skuExists = await this.db.queryOne(`SELECT id FROM products WHERE sku = $1`, [dto.sku]);
      if (skuExists) throw new ConflictException(`SKU '${dto.sku}' already exists`);

      const barcodeExists = await this.db.queryOne(`SELECT id FROM products WHERE barcode = $1`, [dto.barcode]);
      if (barcodeExists) throw new ConflictException(`Barcode '${dto.barcode}' already exists`);

      const [row] = await this.db.query(`
        INSERT INTO products (id, "categoryId", sku, barcode, name, description, uom, "costPrice", "sellingPrice", "isBatchTracked")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *
      `, [uuidv4(), dto.categoryId, dto.sku, dto.barcode, dto.name, dto.description ?? null,
          dto.uom, dto.costPrice, dto.sellingPrice, dto.isBatchTracked ?? false]);

      return this.findOne(row.id);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException();
    }
  }

  async update(id: string, dto: UpdateProductDto) {
    try {
      await this.findOne(id);

      if (dto.sku) {
        const dup = await this.db.queryOne(`SELECT id FROM products WHERE sku = $1 AND id != $2`, [dto.sku, id]);
        if (dup) throw new ConflictException(`SKU '${dto.sku}' already in use`);
      }
      if (dto.barcode) {
        const dup = await this.db.queryOne(`SELECT id FROM products WHERE barcode = $1 AND id != $2`, [dto.barcode, id]);
        if (dup) throw new ConflictException(`Barcode '${dto.barcode}' already in use`);
      }

      const fields: string[] = [];
      const params: any[] = [];
      const map: Record<string, string> = {
        categoryId: '"categoryId"', sku: 'sku', barcode: 'barcode', name: 'name',
        description: 'description', uom: 'uom', costPrice: '"costPrice"',
        sellingPrice: '"sellingPrice"', isBatchTracked: '"isBatchTracked"',
      };

      for (const [key, col] of Object.entries(map)) {
        if ((dto as any)[key] !== undefined) {
          params.push((dto as any)[key]);
          fields.push(`${col} = $${params.length}`);
        }
      }

      if (fields.length === 0) return this.findOne(id);

      params.push(id);
      await this.db.query(`UPDATE products SET ${fields.join(', ')} WHERE id = $${params.length}`, params);
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
      const [row] = await this.db.query(`DELETE FROM products WHERE id = $1 RETURNING *`, [id]);
      return row;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      if (error.code === '23503') throw new BadRequestException('Cannot delete product — it has linked batches or inventory records. Remove those first.');
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException();
    }
  }
}
