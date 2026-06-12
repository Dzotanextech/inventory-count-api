import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RolesService {
  constructor(private db: DatabaseService) {}

  async findAll() {
    return this.db.query(`SELECT * FROM roles ORDER BY name ASC`);
  }

  async findOne(id: string) {
    const role = await this.db.queryOne(`SELECT * FROM roles WHERE id = $1`, [id]);
    if (!role) throw new NotFoundException(`Role ${id} not found`);
    return role;
  }

  async create(dto: CreateRoleDto) {
    const existing = await this.db.queryOne(`SELECT id FROM roles WHERE name = $1`, [dto.name]);
    if (existing) throw new ConflictException(`Role '${dto.name}' already exists`);

    const [row] = await this.db.query(
      `INSERT INTO roles (id, name, "createdAt") VALUES ($1, $2, NOW()) RETURNING *`,
      [uuidv4(), dto.name],
    );
    return row;
  }

  async remove(id: string) {
    await this.findOne(id);
    const [row] = await this.db.query(`DELETE FROM roles WHERE id = $1 RETURNING *`, [id]);
    return row;
  }
}
