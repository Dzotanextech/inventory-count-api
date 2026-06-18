import { Injectable, ConflictException, NotFoundException, BadRequestException, HttpException, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RolesService {
  constructor(private db: DatabaseService) {}

  async findAll() {
    try {
      return await this.db.query(`SELECT * FROM roles ORDER BY name ASC`);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }

  async findOne(id: string) {
    try {
      const role = await this.db.queryOne(`SELECT * FROM roles WHERE id = $1`, [id]);
      if (!role) throw new NotFoundException(`Role ${id} not found`);
      return role;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }

  async create(dto: CreateRoleDto) {
    try {
      const existing = await this.db.queryOne(`SELECT id FROM roles WHERE name = $1`, [dto.name]);
      if (existing) throw new ConflictException(`Role '${dto.name}' already exists`);

      const [row] = await this.db.query(
        `INSERT INTO roles (id, name, "createdAt") VALUES ($1, $2, NOW()) RETURNING *`,
        [uuidv4(), dto.name],
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
      const [row] = await this.db.query(`DELETE FROM roles WHERE id = $1 RETURNING *`, [id]);
      return row;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if ((error as any).code === '23503') throw new BadRequestException('Cannot delete role — it is assigned to one or more users. Reassign those users first.');
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }
}
