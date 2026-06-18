import { Injectable, NotFoundException, HttpException, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';

@Injectable()
export class ApprovalsService {
  constructor(private db: DatabaseService) {}

  async findAll(query: PaginationDto & { inventoryCountId?: string }) {
    try {
      const params: any[] = [];
      const conditions: string[] = [];

      if (query.inventoryCountId) {
        params.push(query.inventoryCountId);
        conditions.push(`a."inventoryCountId" = $${params.length}`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      params.push(query.limit, query.skip);
      const limitIdx = params.length - 1;
      const offsetIdx = params.length;

      const data = await this.db.query(`
        SELECT a.*,
          json_build_object('id', u.id, 'name', u.name, 'email', u.email) AS "performedBy",
          json_build_object('id', ic.id, 'countNumber', ic."countNumber", 'status', ic.status) AS "inventoryCount"
        FROM approvals a
        JOIN users u ON u.id = a."performedById"
        JOIN inventory_counts ic ON ic.id = a."inventoryCountId"
        ${where}
        ORDER BY a."createdAt" DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `, params);

      const countParams = params.slice(0, params.length - 2);
      const [{ count }] = await this.db.query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM approvals a ${where}`,
        countParams,
      );

      return paginate(data, Number(count), query.page, query.limit);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }

  async findOne(id: string) {
    try {
      const approval = await this.db.queryOne(`
        SELECT a.*,
          json_build_object('id', u.id, 'name', u.name, 'email', u.email) AS "performedBy",
          json_build_object('id', ic.id, 'countNumber', ic."countNumber", 'status', ic.status) AS "inventoryCount"
        FROM approvals a
        JOIN users u ON u.id = a."performedById"
        JOIN inventory_counts ic ON ic.id = a."inventoryCountId"
        WHERE a.id = $1
      `, [id]);

      if (!approval) throw new NotFoundException(`Approval ${id} not found`);
      return approval;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }

  async findByCount(inventoryCountId: string) {
    try {
      return await this.db.query(`
        SELECT a.*,
          json_build_object('id', u.id, 'name', u.name) AS "performedBy"
        FROM approvals a
        JOIN users u ON u.id = a."performedById"
        WHERE a."inventoryCountId" = $1
        ORDER BY a."createdAt" ASC
      `, [inventoryCountId]);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }
}
