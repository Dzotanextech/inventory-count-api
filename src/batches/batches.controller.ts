import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiCreatedResponse } from '@nestjs/swagger';
import { BatchesService } from './batches.service';
import { CreateBatchDto } from './dto/create-batch.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, UserRole } from '../common/decorators/roles.decorator';
import { IsOptional, IsUUID } from 'class-validator';

class BatchQueryDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  productId?: string;
}

@ApiTags('batches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('batches')
export class BatchesController {
  constructor(private readonly batchesService: BatchesService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.COUNTER, UserRole.REVIEWER)
  @ApiOperation({ summary: 'List batches, filterable by product' })
  @ApiQuery({ name: 'productId', required: false })
  findAll(@Query() query: BatchQueryDto) {
    return this.batchesService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.COUNTER, UserRole.REVIEWER)
  @ApiOperation({ summary: 'Get batch by ID' })
  findOne(@Param('id') id: string) {
    return this.batchesService.findOne(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.WAREHOUSE_MANAGER)
  @ApiOperation({ summary: 'Create a batch' })
  @ApiCreatedResponse()
  create(@Body() dto: CreateBatchDto) {
    return this.batchesService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.WAREHOUSE_MANAGER)
  @ApiOperation({ summary: 'Update a batch' })
  update(@Param('id') id: string, @Body() dto: UpdateBatchDto) {
    return this.batchesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a batch' })
  remove(@Param('id') id: string) {
    return this.batchesService.remove(id);
  }
}
