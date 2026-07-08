import { Injectable, NotFoundException, ConflictException, BadRequestException, HttpException, InternalServerErrorException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const USER_COLS = `
  u.id, u.name, u.email, u."isActive", u."createdAt", u."updatedAt",
  json_build_object('id', r.id, 'name', r.name) AS role
`;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private db: DatabaseService) {}

  async findAll(query: PaginationDto) {
    try {
      const params: any[] = [];
      let where = '';

      if (query.search) {
        params.push(`%${query.search}%`);
        where = `WHERE u.name ILIKE $1 OR u.email ILIKE $1`;
      }

      params.push(query.limit, query.skip);
      const limitIdx = params.length - 1;
      const offsetIdx = params.length;

      const data = await this.db.query(`
        SELECT ${USER_COLS}
        FROM users u JOIN roles r ON r.id = u."roleId"
        ${where}
        ORDER BY u."createdAt" DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `, params);

      const countParams = query.search ? [`%${query.search}%`] : [];
      const countWhere = query.search ? `WHERE name ILIKE $1 OR email ILIKE $1` : '';
      const [{ count }] = await this.db.query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM users ${countWhere}`,
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
      const user = await this.db.queryOne(`
        SELECT ${USER_COLS}
        FROM users u JOIN roles r ON r.id = u."roleId"
        WHERE u.id = $1
      `, [id]);
      if (!user) throw new NotFoundException(`User ${id} not found`);
      return user;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException();
    }
  }

  async create(dto: CreateUserDto) {
    try {
      const exists = await this.db.queryOne(`SELECT id FROM users WHERE email = $1`, [dto.email]);
      if (exists) throw new ConflictException('Email already registered');

      const passwordHash = await bcrypt.hash(dto.password, 12);
      const id = uuidv4();
      const now = new Date();

      await this.db.query(`
        INSERT INTO users (id, name, email, password_hash, "roleId", "isActive", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
      `, [id, dto.name, dto.email, passwordHash, dto.roleId, dto.isActive ?? true, now]);

      return this.findOne(id);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException();
    }
  }

  async update(id: string, dto: UpdateUserDto) {
    try {
      await this.findOne(id);

      if (dto.email) {
        const exists = await this.db.queryOne(
          `SELECT id FROM users WHERE email = $1 AND id != $2`,
          [dto.email, id],
        );
        if (exists) throw new ConflictException('Email already in use');
      }

      const fields: string[] = ['"updatedAt" = NOW()'];
      const params: any[] = [];

      if (dto.name) { params.push(dto.name); fields.push(`name = $${params.length}`); }
      if (dto.email) { params.push(dto.email); fields.push(`email = $${params.length}`); }
      if (dto.roleId) { params.push(dto.roleId); fields.push(`"roleId" = $${params.length}`); }
      if (dto.isActive !== undefined) { params.push(dto.isActive); fields.push(`"isActive" = $${params.length}`); }
      if (dto.password) {
        const hash = await bcrypt.hash(dto.password, 12);
        params.push(hash);
        fields.push(`password_hash = $${params.length}`);
      }

      params.push(id);
      await this.db.query(
        `UPDATE users SET ${fields.join(', ')} WHERE id = $${params.length}`,
        params,
      );

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
      await this.db.query(`DELETE FROM users WHERE id = $1`, [id]);
      return { message: 'User deleted successfully' };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      if (error.code === '23503') throw new BadRequestException('Cannot delete user — they have linked records. Reassign or remove those first.');
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException();
    }
  }

  async toggleActive(id: string) {
    try {
      const user = await this.findOne(id) as any;
      await this.db.query(
        `UPDATE users SET "isActive" = $1, "updatedAt" = NOW() WHERE id = $2`,
        [!user.isActive, id],
      );
      return this.findOne(id);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException();
    }
  }
}
