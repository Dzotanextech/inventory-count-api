import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiCreatedResponse } from '@nestjs/swagger';
import { RacksService } from './racks.service';
import { CreateRackDto } from './dto/create-rack.dto';
import { UpdateRackDto } from './dto/update-rack.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, UserRole } from '../common/decorators/roles.decorator';
import { IsOptional, IsUUID } from 'class-validator';

class RackQueryDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}

@ApiTags('racks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('racks')
export class RacksController {
  constructor(private readonly racksService: RacksService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.COUNTER, UserRole.REVIEWER)
  @ApiOperation({ summary: 'List racks, filterable by zone or warehouse' })
  findAll(@Query() query: RackQueryDto) {
    return this.racksService.findAll(query);
  }

  @Get('barcode/:barcode')
  @Roles(UserRole.SUPER_ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.COUNTER)
  @ApiOperation({ summary: 'Look up rack by barcode (for scanner)' })
  findByBarcode(@Param('barcode') barcode: string) {
    return this.racksService.findByBarcode(barcode);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.REVIEWER)
  @ApiOperation({ summary: 'Get rack by ID' })
  findOne(@Param('id') id: string) {
    return this.racksService.findOne(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.WAREHOUSE_MANAGER)
  @ApiOperation({ summary: 'Create a rack' })
  @ApiCreatedResponse()
  create(@Body() dto: CreateRackDto) {
    return this.racksService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.WAREHOUSE_MANAGER)
  @ApiOperation({ summary: 'Update a rack' })
  update(@Param('id') id: string, @Body() dto: UpdateRackDto) {
    return this.racksService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a rack' })
  remove(@Param('id') id: string) {
    return this.racksService.remove(id);
  }
}
