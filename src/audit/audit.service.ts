import { Injectable, HttpException, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';
import { v4 as uuidv4 } from 'uuid';

interface LogParams {
  entityType: string;
  entityId: string;
  action: string;
  oldValue?: any;
  newValue?: any;
  performedById: string;
}

@Injectable()
export class AuditService {
  constructor(private db: DatabaseService) {}

  async log(params: LogParams) {
    try {
      const [row] = await this.db.query(`
        INSERT INTO audit_logs (id, "entityType", "entityId", action, "oldValue", "newValue", "performedById", "createdAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *
      `, [
        uuidv4(), params.entityType, params.entityId, params.action,
        params.oldValue ? JSON.stringify(params.oldValue) : null,
        params.newValue ? JSON.stringify(params.newValue) : null,
        params.performedById,
      ]);
      return row;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }

  async findAll(query: PaginationDto & { entityType?: string; entityId?: string }) {
    try {
      const params: any[] = [];
      const conditions: string[] = [];

      if (query.entityType) { params.push(query.entityType); conditions.push(`al."entityType" = $${params.length}`); }
      if (query.entityId) { params.push(query.entityId); conditions.push(`al."entityId" = $${params.length}`); }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      params.push(query.limit, query.skip);
      const limitIdx = params.length - 1;
      const offsetIdx = params.length;

      const data = await this.db.query(`
        SELECT al.*,
          json_build_object('id', u.id, 'name', u.name, 'email', u.email) AS "performedBy"
        FROM audit_logs al
        JOIN users u ON u.id = al."performedById"
        ${where}
        ORDER BY al."createdAt" DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `, params);

      const countParams = params.slice(0, params.length - 2);
      const [{ count }] = await this.db.query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM audit_logs al ${where}`,
        countParams,
      );

      return paginate(data, Number(count), query.page, query.limit);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }

  async findForEntity(entityType: string, entityId: string) {
    try {
      return await this.db.query(`
        SELECT al.*,
          json_build_object('id', u.id, 'name', u.name) AS "performedBy"
        FROM audit_logs al
        JOIN users u ON u.id = al."performedById"
        WHERE al."entityType" = $1 AND al."entityId" = $2
        ORDER BY al."createdAt" ASC
      `, [entityType, entityId]);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }
}
