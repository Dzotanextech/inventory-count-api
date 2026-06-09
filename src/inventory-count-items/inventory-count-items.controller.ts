import {
  Controller, Get, Post, Patch, Param, Body, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { InventoryCountItemsService } from './inventory-count-items.service';
import { CreateCountItemDto } from './dto/create-count-item.dto';
import { UpdateCountItemDto } from './dto/update-count-item.dto';
import { ScanProductDto } from './dto/scan-product.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, UserRole } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/decorators/current-user.decorator';

@ApiTags('inventory-count-items')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory-count-items')
export class InventoryCountItemsController {
  constructor(private readonly service: InventoryCountItemsService) {}

  @Get('by-count/:countId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.COUNTER, UserRole.REVIEWER)
  @ApiOperation({ summary: 'Get all items for a specific inventory count' })
  findAll(@Param('countId') countId: string) {
    return this.service.findAll(countId);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.COUNTER, UserRole.REVIEWER)
  @ApiOperation({ summary: 'Get a single count item by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.WAREHOUSE_MANAGER)
  @ApiOperation({ summary: 'Manually add an item to a count' })
  @ApiCreatedResponse()
  addItem(@Body() dto: CreateCountItemDto, @CurrentUser() user: JwtPayload) {
    return this.service.addItem(dto, user.sub);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.COUNTER)
  @ApiOperation({ summary: 'Record physical count for an item (calculates variance automatically)' })
  updateItem(
    @Param('id') id: string,
    @Body() dto: UpdateCountItemDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateItem(id, dto, user.sub);
  }

  @Post('scan')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.COUNTER)
  @ApiOperation({ summary: 'Scan a product barcode and record quantity (creates or updates item)' })
  scan(@Body() dto: ScanProductDto, @CurrentUser() user: JwtPayload) {
    return this.service.scan(dto, user.sub);
  }
}
