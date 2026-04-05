import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import * as argon2 from 'argon2';
import { UsersService } from '../users/users.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { RegisterDto } from './dto/register.dto';
import { User } from '../users/entities/user.entity';

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;

function parseTtlMs(val: string): number {
  const m = /^(\d+)(d|h|m|s)$/.exec(val);
  if (!m) return 7 * 24 * 60 * 60 * 1000;
  const n = parseInt(m[1], 10);
  const units: Record<string, number> = {
    d: 86_400_000,
    h: 3_600_000,
    m: 60_000,
    s: 1_000,
  };
  return n * (units[m[2]] ?? 86_400_000);
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.usersService.findByEmail(dto.email);
    if (exists) throw new ConflictException('Email already registered');

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.usersService.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
    });

    return this.issueTokens(user);
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isActive) return null;

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException(
        `Account locked until ${user.lockedUntil.toISOString()}`,
      );
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      user.failedLogins += 1;
      if (user.failedLogins >= MAX_FAILED_LOGINS) {
        const lockUntil = new Date();
        lockUntil.setMinutes(lockUntil.getMinutes() + LOCKOUT_MINUTES);
        user.lockedUntil = lockUntil;
      }
      await this.usersService.save(user);
      return null;
    }

    if (user.failedLogins > 0 || user.lockedUntil) {
      user.failedLogins = 0;
      user.lockedUntil = null;
      await this.usersService.save(user);
    }

    return user;
  }

  login(user: User) {
    return this.issueTokens(user);
  }

  async refresh(token: string) {
    let payload: { sub: string; email: string; type?: string };
    try {
      payload = this.jwtService.verify<typeof payload>(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const hash = createHash('sha256').update(token).digest('hex');
    const stored = await this.refreshTokenRepo.findOne({
      where: { tokenHash: hash, userId: payload.sub },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      // Possible token reuse — revoke all for this user
      await this.refreshTokenRepo.update(
        { userId: payload.sub },
        { revokedAt: new Date() },
      );
      throw new UnauthorizedException('Refresh token invalid or reused');
    }

    stored.revokedAt = new Date();
    await this.refreshTokenRepo.save(stored);

    const user = await this.usersService.findById(payload.sub);
    if (!user) throw new UnauthorizedException();

    return this.issueTokens(user);
  }

  async logout(token: string): Promise<void> {
    const hash = createHash('sha256').update(token).digest('hex');
    await this.refreshTokenRepo.update({ tokenHash: hash }, { revokedAt: new Date() });
  }

  private async issueTokens(user: User) {
    const payload = { sub: user.id, email: user.email };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m',
    });

    const refreshTtl = this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    const refreshToken = this.jwtService.sign(
      { ...payload, type: 'refresh' },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshTtl,
      },
    );

    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + parseTtlMs(refreshTtl));

    await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({ tokenHash, userId: user.id, expiresAt }),
    );

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }
}
