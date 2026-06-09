import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtPayload } from '../common/decorators/current-user.decorator';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });

    if (!user || !user.isActive) return null;

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return null;

    return user;
  }

  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.email, dto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.generateAuthResponse(user);
  }

  async refresh(dto: RefreshTokenDto) {
    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId: dto.userId, expiresAt: { gt: new Date() } },
      include: { user: { include: { role: true } } },
    });

    let matched: (typeof tokens)[0] | null = null;
    for (const t of tokens) {
      const isValid = await bcrypt.compare(dto.refreshToken, t.tokenHash);
      if (isValid) { matched = t; break; }
    }

    if (!matched) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (!matched.user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    await this.prisma.refreshToken.delete({ where: { id: matched.id } });

    return this.generateAuthResponse(matched.user);
  }

  async logout(userId: string, refreshToken: string) {
    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId },
    });

    for (const t of tokens) {
      const match = await bcrypt.compare(refreshToken, t.tokenHash);
      if (match) {
        await this.prisma.refreshToken.delete({ where: { id: t.id } });
        break;
      }
    }

    return { message: 'Logged out successfully' };
  }

  async logoutAll(userId: string) {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    return { message: 'All sessions terminated' };
  }

  private async generateAuthResponse(user: any) {
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

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + refreshExpiresIn),
      },
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.name,
      },
      tokens: {
        accessToken,
        refreshToken: rawRefreshToken,
        expiresIn: 15 * 60,
      },
    };
  }
}
