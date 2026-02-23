import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto, tenantIdFromHeader?: string) {
    const tenantId = tenantIdFromHeader ?? dto.tenantId;

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    if (user.tenantId !== tenantId) {
      throw new UnauthorizedException('Tenant mismatch.');
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const permissions = user.role.rolePermissions.map(
      (item) => item.permission.key,
    );

    const payload = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role.name,
      permissions,
    };

    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        tenantId: user.tenantId,
        branchId: user.branchId,
        role: user.role.name,
        permissions,
      },
    };
  }
}
