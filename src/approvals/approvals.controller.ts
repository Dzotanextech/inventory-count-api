import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ApprovalsService } from './approvals.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, UserRole } from '../common/decorators/roles.decorator';
import { IsOptional, IsUUID } from 'class-validator';

class ApprovalQueryDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  inventoryCountId?: string;
}

@ApiTags('approvals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.REVIEWER)
@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Get()
  @ApiOperation({ summary: 'List approval history' })
  @ApiQuery({ name: 'inventoryCountId', required: false })
  findAll(@Query() query: ApprovalQueryDto) {
    return this.approvalsService.findAll(query);
  }

  @Get('by-count/:countId')
  @ApiOperation({ summary: 'Get approval trail for a specific count' })
  findByCount(@Param('countId') countId: string) {
    return this.approvalsService.findByCount(countId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get approval record by ID' })
  findOne(@Param('id') id: string) {
    return this.approvalsService.findOne(id);
  }
}
