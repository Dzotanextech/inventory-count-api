import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiCreatedResponse } from '@nestjs/swagger';
import { InventoryLocationsService } from './inventory-locations.service';
import { CreateInventoryLocationDto } from './dto/create-inventory-location.dto';
import { UpdateInventoryLocationDto } from './dto/update-inventory-location.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, UserRole } from '../common/decorators/roles.decorator';
import { IsOptional, IsUUID } from 'class-validator';

class LocationQueryDto extends PaginationDto {
  @IsOptional() @IsUUID() warehouseId?: string;
  @IsOptional() @IsUUID() productId?: string;
  @IsOptional() @IsUUID() rackId?: string;
}

@ApiTags('inventory-locations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory-locations')
export class InventoryLocationsController {
  constructor(private readonly service: InventoryLocationsService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.REVIEWER)
  @ApiOperation({ summary: 'List inventory locations (current stock)' })
  findAll(@Query() query: LocationQueryDto) {
    return this.service.findAll(query);
  }

  @Get('warehouse/:warehouseId/summary')
  @Roles(UserRole.SUPER_ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.REVIEWER)
  @ApiOperation({ summary: 'Get full stock summary for a warehouse' })
  getStockSummary(@Param('warehouseId') warehouseId: string) {
    return this.service.getStockSummary(warehouseId);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.REVIEWER)
  @ApiOperation({ summary: 'Get inventory location by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.WAREHOUSE_MANAGER)
  @ApiOperation({ summary: 'Create or update an inventory location (upsert)' })
  @ApiCreatedResponse()
  upsert(@Body() dto: CreateInventoryLocationDto) {
    return this.service.upsert(dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.WAREHOUSE_MANAGER)
  @ApiOperation({ summary: 'Update quantity at a location' })
  update(@Param('id') id: string, @Body() dto: UpdateInventoryLocationDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Remove an inventory location record' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
