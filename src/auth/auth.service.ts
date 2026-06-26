import { Injectable, UnauthorizedException, HttpException, InternalServerErrorException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtPayload } from '../common/decorators/current-user.decorator';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private db: DatabaseService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string) {
    try {
      const user = await this.db.queryOne<any>(`
        SELECT u.*, r.id AS "roleId", r.name AS "roleName"
        FROM users u
        JOIN roles r ON r.id = u."roleId"
        WHERE u.email = $1
      `, [email]);

      if (!user || !user.isActive) return null;

      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) return null;

      return { ...user, role: { id: user.roleId, name: user.roleName } };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  async login(dto: LoginDto) {
    try {
      const user = await this.validateUser(dto.email, dto.password);
      if (!user) throw new UnauthorizedException('Invalid email or password');
      return this.generateAuthResponse(user);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  async refresh(dto: RefreshTokenDto) {
    try {
      const tokens = await this.db.query<any>(`
        SELECT rt.*, u.id AS "userId", u.name AS "userName", u.email AS "userEmail",
               u."isActive", r.id AS "roleId", r.name AS "roleName"
        FROM refresh_tokens rt
        JOIN users u ON u.id = rt."userId"
        JOIN roles r ON r.id = u."roleId"
        WHERE rt."userId" = $1 AND rt."expiresAt" > NOW()
      `, [dto.userId]);

      let matched: any = null;
      for (const t of tokens) {
        const isValid = await bcrypt.compare(dto.refreshToken, t.token_hash);
        if (isValid) { matched = t; break; }
      }

      if (!matched) throw new UnauthorizedException('Invalid or expired refresh token');
      if (!matched.isActive) throw new UnauthorizedException('Account is deactivated');

      await this.db.query(`DELETE FROM refresh_tokens WHERE id = $1`, [matched.id]);

      const user = {
        id: matched.userId,
        name: matched.userName,
        email: matched.userEmail,
        isActive: matched.isActive,
        role: { id: matched.roleId, name: matched.roleName },
      };
      return this.generateAuthResponse(user);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  async logout(userId: string, refreshToken: string) {
    try {
      const tokens = await this.db.query<any>(
        `SELECT * FROM refresh_tokens WHERE "userId" = $1`,
        [userId],
      );

      for (const t of tokens) {
        const match = await bcrypt.compare(refreshToken, t.token_hash);
        if (match) {
          await this.db.query(`DELETE FROM refresh_tokens WHERE id = $1`, [t.id]);
          break;
        }
      }

      return { message: 'Logged out successfully' };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  async logoutAll(userId: string) {
    try {
      await this.db.query(`DELETE FROM refresh_tokens WHERE "userId" = $1`, [userId]);
      return { message: 'All sessions terminated' };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  private async generateAuthResponse(user: any) {
    try {
      const payload: JwtPayload = {
        sub: user.id,
        email: user.email,
        role: user.role.name,
        name: user.name,
      };

      const accessToken = this.jwtService.sign(payload, {
        secret: this.configService.get('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get('JWT_ACCESS_EXPIRES_IN') ?? '15m',
      });

      const rawRefreshToken = uuidv4();
      const refreshExpiresIn = 7 * 24 * 60 * 60 * 1000;
      const tokenHash = await bcrypt.hash(rawRefreshToken, 10);

      await this.db.query(
        `INSERT INTO refresh_tokens (id, "userId", token_hash, "expiresAt", "createdAt")
         VALUES ($1, $2, $3, $4, NOW())`,
        [uuidv4(), user.id, tokenHash, new Date(Date.now() + refreshExpiresIn)],
      );

      return {
        user: { id: user.id, name: user.name, email: user.email, role: user.role.name },
        tokens: { accessToken, refreshToken: rawRefreshToken, expiresIn: 15 * 60 },
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }
}
