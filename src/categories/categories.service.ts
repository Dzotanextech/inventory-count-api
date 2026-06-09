import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: PaginationDto) {
    const where = query.search
      ? { name: { contains: query.search, mode: 'insensitive' as const } }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { name: 'asc' },
        include: { _count: { select: { products: true } } },
      }),
      this.prisma.category.count({ where }),
    ]);

    return paginate(data, total, query.page, query.limit);
  }

  async findOne(id: string) {
    const cat = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!cat) throw new NotFoundException(`Category ${id} not found`);
    return cat;
  }

  async create(dto: CreateCategoryDto) {
    const exists = await this.prisma.category.findUnique({ where: { name: dto.name } });
    if (exists) throw new ConflictException(`Category '${dto.name}' already exists`);
    return this.prisma.category.create({ data: dto });
  }

  async update(id: string, dto: Partial<CreateCategoryDto>) {
    await this.findOne(id);
    if (dto.name) {
      const dup = await this.prisma.category.findFirst({
        where: { name: dto.name, NOT: { id } },
      });
      if (dup) throw new ConflictException(`Category '${dto.name}' already exists`);
    }
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    try {
      return await this.prisma.category.delete({ where: { id } });
    } catch {
      throw new BadRequestException('Cannot delete category — it has linked products. Remove those first.');
    }
  }
}
