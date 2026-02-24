import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { QueryCustomersDto } from './dto/query-customers.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, query: QueryCustomersDto) {
    const where: Prisma.CustomerWhereInput = {
      tenantId,
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q } },
              { phone: { contains: query.q } },
              { email: { contains: query.q } },
            ],
          }
        : {}),
    };

    return this.prisma.customer.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  create(tenantId: string, dto: CreateCustomerDto) {
    return this.prisma.customer.create({
      data: {
        tenantId,
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        notes: dto.notes,
      },
    });
  }

  async detail(tenantId: string, customerId: string) {
    const record = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        tenantId,
      },
    });

    if (!record) {
      throw new NotFoundException('Customer not found.');
    }

    return record;
  }

  async update(tenantId: string, customerId: string, dto: UpdateCustomerDto) {
    const existing = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        tenantId,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Customer not found.');
    }

    return this.prisma.customer.update({
      where: {
        id: customerId,
      },
      data: {
        ...dto,
      },
    });
  }
}
