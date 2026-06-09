import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBatchDto } from './dto/create-batch.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';

@Injectable()
export class BatchesService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: PaginationDto & { productId?: string }) {
    const where: any = {};
    if (query.productId) where.productId = query.productId;
    if (query.search) {
      where.batchNumber = { contains: query.search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.batch.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { batchNumber: 'asc' },
        include: { product: { select: { id: true, sku: true, name: true } } },
      }),
      this.prisma.batch.count({ where }),
    ]);

    return paginate(data, total, query.page, query.limit);
  }

  async findOne(id: string) {
    const batch = await this.prisma.batch.findUnique({
      where: { id },
      include: { product: { select: { id: true, sku: true, name: true } } },
    });
    if (!batch) throw new NotFoundException(`Batch ${id} not found`);
    return batch;
  }

  async create(dto: CreateBatchDto) {
    const dup = await this.prisma.batch.findUnique({
      where: { productId_batchNumber: { productId: dto.productId, batchNumber: dto.batchNumber } },
    });
    if (dup) throw new ConflictException(`Batch '${dto.batchNumber}' already exists for this product`);

    return this.prisma.batch.create({
      data: {
        productId: dto.productId,
        batchNumber: dto.batchNumber,
        manufacturingDate: dto.manufacturingDate ? new Date(dto.manufacturingDate) : null,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
      },
      include: { product: { select: { id: true, sku: true, name: true } } },
    });
  }

  async update(id: string, dto: UpdateBatchDto) {
    const batch = await this.findOne(id);

    if (dto.batchNumber) {
      const dup = await this.prisma.batch.findFirst({
        where: {
          productId: batch.productId,
          batchNumber: dto.batchNumber,
          NOT: { id },
        },
      });
      if (dup) throw new ConflictException(`Batch number '${dto.batchNumber}' already in use`);
    }

    return this.prisma.batch.update({
      where: { id },
      data: {
        batchNumber: dto.batchNumber,
        manufacturingDate: dto.manufacturingDate ? new Date(dto.manufacturingDate) : undefined,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
      },
      include: { product: { select: { id: true, sku: true, name: true } } },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.batch.delete({ where: { id } });
  }
}
