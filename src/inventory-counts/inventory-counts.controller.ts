import {
  Controller, Get, Post, Param, Body, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiCreatedResponse, ApiOkResponse,
} from '@nestjs/swagger';
import { InventoryCountsService } from './inventory-counts.service';
import { CreateInventoryCountDto } from './dto/create-inventory-count.dto';
import { QueryInventoryCountDto } from './dto/query-inventory-count.dto';
import { ApproveRejectDto } from './dto/approve-reject.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, UserRole } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/decorators/current-user.decorator';

@ApiTags('inventory-counts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory-counts')
export class InventoryCountsController {
  constructor(private readonly service: InventoryCountsService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.REVIEWER, UserRole.COUNTER)
  @ApiOperation({ summary: 'List inventory counts with filters' })
  findAll(@Query() query: QueryInventoryCountDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.REVIEWER, UserRole.COUNTER)
  @ApiOperation({ summary: 'Get full count details with items and approvals' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.WAREHOUSE_MANAGER)
  @ApiOperation({ summary: 'Create a new inventory count (auto-loads items from stock)' })
  @ApiCreatedResponse()
  create(@Body() dto: CreateInventoryCountDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN, UserRole.WAREHOUSE_MANAGER)
  @ApiOperation({ summary: 'Start a count (DRAFT → IN_PROGRESS)' })
  start(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.start(id, user.sub);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.COUNTER)
  @ApiOperation({ summary: 'Submit a count for review (IN_PROGRESS → SUBMITTED)' })
  submit(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.submit(id, user.sub);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REVIEWER)
  @ApiOperation({ summary: 'Approve count and update inventory (SUBMITTED → APPROVED)' })
  approve(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ApproveRejectDto,
  ) {
    return this.service.approve(id, user.sub, dto.remarks);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REVIEWER)
  @ApiOperation({ summary: 'Reject a submitted count (SUBMITTED → REJECTED)' })
  reject(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ApproveRejectDto,
  ) {
    return this.service.reject(id, user.sub, dto.remarks);
  }

  @Post(':id/recount')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REVIEWER)
  @ApiOperation({ summary: 'Request a recount (SUBMITTED → RECOUNT)' })
  requestRecount(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ApproveRejectDto,
  ) {
    return this.service.requestRecount(id, user.sub, dto.remarks);
  }
}
