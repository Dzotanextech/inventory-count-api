import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: PaginationDto & { categoryId?: string }) {
    const where: any = {};
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
        { barcode: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { name: 'asc' },
        include: { category: { select: { id: true, name: true } } },
      }),
      this.prisma.product.count({ where }),
    ]);

    return paginate(data, total, query.page, query.limit);
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
        batches: true,
      },
    });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  async findByBarcode(barcode: string) {
    const product = await this.prisma.product.findUnique({
      where: { barcode },
      include: {
        category: { select: { id: true, name: true } },
        batches: true,
      },
    });
    if (!product) throw new NotFoundException(`Product with barcode '${barcode}' not found`);
    return product;
  }

  async create(dto: CreateProductDto) {
    const skuExists = await this.prisma.product.findUnique({ where: { sku: dto.sku } });
    if (skuExists) throw new ConflictException(`SKU '${dto.sku}' already exists`);

    const barcodeExists = await this.prisma.product.findUnique({ where: { barcode: dto.barcode } });
    if (barcodeExists) throw new ConflictException(`Barcode '${dto.barcode}' already exists`);

    return this.prisma.product.create({
      data: {
        categoryId: dto.categoryId,
        sku: dto.sku,
        barcode: dto.barcode,
        name: dto.name,
        description: dto.description,
        uom: dto.uom,
        costPrice: dto.costPrice,
        sellingPrice: dto.sellingPrice,
        isBatchTracked: dto.isBatchTracked ?? false,
      },
      include: { category: { select: { id: true, name: true } } },
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);

    if (dto.sku) {
      const dup = await this.prisma.product.findFirst({ where: { sku: dto.sku, NOT: { id } } });
      if (dup) throw new ConflictException(`SKU '${dto.sku}' already in use`);
    }

    if (dto.barcode) {
      const dup = await this.prisma.product.findFirst({ where: { barcode: dto.barcode, NOT: { id } } });
      if (dup) throw new ConflictException(`Barcode '${dto.barcode}' already in use`);
    }

    return this.prisma.product.update({
      where: { id },
      data: dto,
      include: { category: { select: { id: true, name: true } } },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    try {
      return await this.prisma.product.delete({ where: { id } });
    } catch {
      throw new BadRequestException('Cannot delete product — it has linked batches or inventory records. Remove those first.');
    }
  }
}
