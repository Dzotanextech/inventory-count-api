import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiCreatedResponse } from '@nestjs/swagger';
import { ZonesService } from './zones.service';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, UserRole } from '../common/decorators/roles.decorator';
import { IsOptional, IsUUID } from 'class-validator';

class ZoneQueryDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}

@ApiTags('zones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('zones')
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.REVIEWER)
  @ApiOperation({ summary: 'List all zones, optionally filtered by warehouse' })
  @ApiQuery({ name: 'warehouseId', required: false })
  findAll(@Query() query: ZoneQueryDto) {
    return this.zonesService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.REVIEWER)
  @ApiOperation({ summary: 'Get zone by ID with racks' })
  findOne(@Param('id') id: string) {
    return this.zonesService.findOne(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.WAREHOUSE_MANAGER)
  @ApiOperation({ summary: 'Create a zone' })
  @ApiCreatedResponse()
  create(@Body() dto: CreateZoneDto) {
    return this.zonesService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.WAREHOUSE_MANAGER)
  @ApiOperation({ summary: 'Update a zone' })
  update(@Param('id') id: string, @Body() dto: UpdateZoneDto) {
    return this.zonesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a zone' })
  remove(@Param('id') id: string) {
    return this.zonesService.remove(id);
  }
}
