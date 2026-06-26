import { Injectable, NotFoundException, BadRequestException, HttpException, InternalServerErrorException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../audit/audit.service';
import { CreateInventoryCountDto } from './dto/create-inventory-count.dto';
import { QueryInventoryCountDto } from './dto/query-inventory-count.dto';
import { paginate } from '../common/dto/pagination.dto';
import { InventoryCountStatus, InventoryCountType, ApprovalAction } from '../common/enums';
import { v4 as uuidv4 } from 'uuid';

const COUNT_SQL = `
  SELECT ic.*,
    json_build_object('id', w.id, 'code', w.code, 'name', w.name) AS warehouse,
    json_build_object('id', cb.id, 'name', cb.name, 'email', cb.email) AS "createdBy",
    CASE WHEN sb.id IS NOT NULL THEN json_build_object('id', sb.id, 'name', sb.name) END AS "submittedBy",
    CASE WHEN ab.id IS NOT NULL THEN json_build_object('id', ab.id, 'name', ab.name) END AS "approvedBy",
    (SELECT COUNT(*)::int FROM inventory_count_items ici WHERE ici."inventoryCountId" = ic.id) AS "itemCount"
  FROM inventory_counts ic
  JOIN warehouses w ON w.id = ic."warehouseId"
  JOIN users cb ON cb.id = ic."createdById"
  LEFT JOIN users sb ON sb.id = ic."submittedById"
  LEFT JOIN users ab ON ab.id = ic."approvedById"
`;

@Injectable()
export class InventoryCountsService {
  private readonly logger = new Logger(InventoryCountsService.name);

  constructor(
    private db: DatabaseService,
    private auditService: AuditService,
  ) {}

  async findAll(query: QueryInventoryCountDto) {
    try {
      const params: any[] = [];
      const conditions: string[] = [];

      if (query.warehouseId) { params.push(query.warehouseId); conditions.push(`ic."warehouseId" = $${params.length}`); }
      if (query.status) { params.push(query.status); conditions.push(`ic.status = $${params.length}`); }
      if (query.countType) { params.push(query.countType); conditions.push(`ic."countType" = $${params.length}`); }
      if (query.search) {
        params.push(`%${query.search}%`);
        conditions.push(`(ic."countNumber" ILIKE $${params.length} OR ic.notes ILIKE $${params.length})`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      params.push(query.limit, query.skip);
      const limitIdx = params.length - 1;
      const offsetIdx = params.length;

      const data = await this.db.query(
        `${COUNT_SQL} ${where} ORDER BY ic."createdAt" DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        params,
      );

      const countParams = params.slice(0, params.length - 2);
      const [{ count }] = await this.db.query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM inventory_counts ic ${where}`,
        countParams,
      );

      const shaped = data.map((r) => ({ ...r, _count: { items: r.itemCount }, itemCount: undefined }));
      return paginate(shaped, Number(count), query.page, query.limit);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  async findOne(id: string) {
    try {
      const count = await this.db.queryOne<any>(`${COUNT_SQL} WHERE ic.id = $1`, [id]);
      if (!count) throw new NotFoundException(`Inventory count ${id} not found`);

      const items = await this.db.query(`
        SELECT ici.*,
          json_build_object('id', p.id, 'sku', p.sku, 'name', p.name, 'uom', p.uom, 'costPrice', p."costPrice") AS product,
          CASE WHEN b.id IS NOT NULL THEN json_build_object('id', b.id, 'batchNumber', b."batchNumber", 'expiryDate', b."expiryDate") END AS batch,
          CASE WHEN r.id IS NOT NULL THEN json_build_object('id', r.id, 'rackCode', r."rackCode", 'barcode', r.barcode) END AS rack,
          CASE WHEN u.id IS NOT NULL THEN json_build_object('id', u.id, 'name', u.name) END AS "countedBy"
        FROM inventory_count_items ici
        JOIN products p ON p.id = ici."productId"
        LEFT JOIN batches b ON b.id = ici."batchId"
        LEFT JOIN racks r ON r.id = ici."rackId"
        LEFT JOIN users u ON u.id = ici."countedById"
        WHERE ici."inventoryCountId" = $1
        ORDER BY p.name ASC
      `, [id]);

      const approvals = await this.db.query(`
        SELECT a.*,
          json_build_object('id', u.id, 'name', u.name) AS "performedBy"
        FROM approvals a
        JOIN users u ON u.id = a."performedById"
        WHERE a."inventoryCountId" = $1
        ORDER BY a."createdAt" ASC
      `, [id]);

      return { ...count, items, approvals };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  async create(dto: CreateInventoryCountDto, userId: string) {
    try {
      const countNumber = await this.generateCountNumber();

      const locationConditions: string[] = [`il."warehouseId" = $1`];
      const locationParams: any[] = [dto.warehouseId];

      if (dto.countType === InventoryCountType.CATEGORY && dto.categoryId) {
        locationParams.push(dto.categoryId);
        locationConditions.push(`p."categoryId" = $${locationParams.length}`);
      } else if (dto.countType === InventoryCountType.PRODUCT && dto.productIds?.length) {
        locationParams.push(dto.productIds);
        locationConditions.push(`il."productId" = ANY($${locationParams.length})`);
      } else if (dto.countType === InventoryCountType.RACK && dto.rackIds?.length) {
        locationParams.push(dto.rackIds);
        locationConditions.push(`il."rackId" = ANY($${locationParams.length})`);
      }

      const locations = await this.db.query<any>(`
        SELECT il.*, p."costPrice"
        FROM inventory_locations il
        JOIN products p ON p.id = il."productId"
        WHERE ${locationConditions.join(' AND ')}
      `, locationParams);

      const countId = uuidv4();
      const now = new Date();

      await this.db.query(`
        INSERT INTO inventory_counts (
          id, "countNumber", "warehouseId", "countType", status, "countDate", "dueDate",
          "createdById", "totalVarianceValue", notes, "createdAt", "updatedAt"
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$9,$10,$10)
      `, [
        countId, countNumber, dto.warehouseId, dto.countType, InventoryCountStatus.DRAFT,
        new Date(dto.countDate), dto.dueDate ? new Date(dto.dueDate) : null,
        userId, dto.notes ?? null, now,
      ]);

      for (const loc of locations) {
        await this.db.query(`
          INSERT INTO inventory_count_items (id, "inventoryCountId", "productId", "batchId", "rackId", "systemQty")
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [uuidv4(), countId, loc.productId, loc.batchId, loc.rackId, loc.quantity]);
      }

      await this.auditService.log({
        entityType: 'InventoryCount', entityId: countId, action: 'CREATE',
        newValue: { countNumber, status: InventoryCountStatus.DRAFT, countType: dto.countType },
        performedById: userId,
      });

      return this.findOne(countId);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  async start(id: string, userId: string) {
    try {
      const count = await this.findOne(id);
      this.assertStatus(count.status, [InventoryCountStatus.DRAFT, InventoryCountStatus.RECOUNT]);

      await this.db.query(`
        UPDATE inventory_counts SET status = $1, "startedAt" = NOW(), "updatedAt" = NOW() WHERE id = $2
      `, [InventoryCountStatus.IN_PROGRESS, id]);

      await this.auditService.log({
        entityType: 'InventoryCount', entityId: id, action: 'START',
        oldValue: { status: count.status }, newValue: { status: InventoryCountStatus.IN_PROGRESS },
        performedById: userId,
      });

      return this.findOne(id);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  async submit(id: string, userId: string) {
    try {
      const count = await this.findOne(id);
      this.assertStatus(count.status, [InventoryCountStatus.IN_PROGRESS]);

      await this.db.transaction(async (client) => {
        await client.query(`
          UPDATE inventory_counts
          SET status = $1, "submittedById" = $2, "submittedAt" = NOW(), "updatedAt" = NOW()
          WHERE id = $3
        `, [InventoryCountStatus.SUBMITTED, userId, id]);

        await client.query(`
          INSERT INTO approvals (id, "inventoryCountId", action, "performedById", "createdAt")
          VALUES ($1, $2, $3, $4, NOW())
        `, [uuidv4(), id, ApprovalAction.SUBMIT, userId]);
      });

      await this.auditService.log({
        entityType: 'InventoryCount', entityId: id, action: 'SUBMIT',
        oldValue: { status: count.status }, newValue: { status: InventoryCountStatus.SUBMITTED },
        performedById: userId,
      });

      return this.findOne(id);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  async approve(id: string, userId: string, remarks?: string) {
    try {
      const count = await this.findOne(id);
      this.assertStatus(count.status, [InventoryCountStatus.SUBMITTED]);

      await this.applyPhysicalCounts(count);

      const totalVariance = (count.items as any[]).reduce((sum: number, item: any) => {
        return sum + (Number(item.varianceValue) || 0);
      }, 0);

      await this.db.transaction(async (client) => {
        await client.query(`
          UPDATE inventory_counts
          SET status = $1, "approvedById" = $2, "approvedAt" = NOW(), "totalVarianceValue" = $3, "updatedAt" = NOW()
          WHERE id = $4
        `, [InventoryCountStatus.APPROVED, userId, totalVariance, id]);

        await client.query(`
          INSERT INTO approvals (id, "inventoryCountId", action, remarks, "performedById", "createdAt")
          VALUES ($1, $2, $3, $4, $5, NOW())
        `, [uuidv4(), id, ApprovalAction.APPROVE, remarks ?? null, userId]);
      });

      await this.auditService.log({
        entityType: 'InventoryCount', entityId: id, action: 'APPROVE',
        oldValue: { status: count.status }, newValue: { status: InventoryCountStatus.APPROVED, totalVarianceValue: totalVariance },
        performedById: userId,
      });

      return this.findOne(id);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  async reject(id: string, userId: string, remarks?: string) {
    try {
      const count = await this.findOne(id);
      this.assertStatus(count.status, [InventoryCountStatus.SUBMITTED]);

      await this.db.transaction(async (client) => {
        await client.query(`UPDATE inventory_counts SET status = $1, "updatedAt" = NOW() WHERE id = $2`, [InventoryCountStatus.REJECTED, id]);
        await client.query(`
          INSERT INTO approvals (id, "inventoryCountId", action, remarks, "performedById", "createdAt")
          VALUES ($1, $2, $3, $4, $5, NOW())
        `, [uuidv4(), id, ApprovalAction.REJECT, remarks ?? null, userId]);
      });

      await this.auditService.log({
        entityType: 'InventoryCount', entityId: id, action: 'REJECT',
        oldValue: { status: count.status }, newValue: { status: InventoryCountStatus.REJECTED },
        performedById: userId,
      });

      return this.findOne(id);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  async requestRecount(id: string, userId: string, remarks?: string) {
    try {
      const count = await this.findOne(id);
      this.assertStatus(count.status, [InventoryCountStatus.SUBMITTED]);

      await this.db.transaction(async (client) => {
        await client.query(`UPDATE inventory_counts SET status = $1, "updatedAt" = NOW() WHERE id = $2`, [InventoryCountStatus.RECOUNT, id]);
        await client.query(`
          INSERT INTO approvals (id, "inventoryCountId", action, remarks, "performedById", "createdAt")
          VALUES ($1, $2, $3, $4, $5, NOW())
        `, [uuidv4(), id, ApprovalAction.RECOUNT, remarks ?? null, userId]);
      });

      await this.auditService.log({
        entityType: 'InventoryCount', entityId: id, action: 'RECOUNT',
        oldValue: { status: count.status }, newValue: { status: InventoryCountStatus.RECOUNT },
        performedById: userId,
      });

      return this.findOne(id);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  private async applyPhysicalCounts(count: any) {
    for (const item of count.items) {
      if (item.physicalQty === null) continue;

      const existing = await this.db.queryOne<any>(`
        SELECT id FROM inventory_locations
        WHERE "warehouseId" = $1
          AND ("rackId" = $2 OR ($2 IS NULL AND "rackId" IS NULL))
          AND "productId" = $3
          AND ("batchId" = $4 OR ($4 IS NULL AND "batchId" IS NULL))
      `, [count.warehouseId, item.rackId ?? null, item.productId, item.batchId ?? null]);

      if (existing) {
        await this.db.query(`UPDATE inventory_locations SET quantity = $1 WHERE id = $2`, [item.physicalQty, existing.id]);
      } else {
        await this.db.query(`
          INSERT INTO inventory_locations (id, "warehouseId", "rackId", "productId", "batchId", quantity)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [uuidv4(), count.warehouseId, item.rackId ?? null, item.productId, item.batchId ?? null, item.physicalQty]);
      }
    }
  }

  private assertStatus(current: string, allowed: InventoryCountStatus[]) {
    if (!allowed.includes(current as InventoryCountStatus)) {
      throw new BadRequestException(
        `Cannot perform this action on a count with status '${current}'. Allowed: ${allowed.join(', ')}`,
      );
    }
  }

  private async generateCountNumber(): Promise<string> {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');

    const todayStart = new Date(y, now.getMonth(), now.getDate());
    const [{ count }] = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM inventory_counts WHERE "createdAt" >= $1`,
      [todayStart],
    );

    const seq = String(Number(count) + 1).padStart(4, '0');
    return `CNT-${y}${m}${d}-${seq}`;
  }
}
