import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { InventoryCountStatus, InventoryCountType } from '../../common/enums';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class QueryInventoryCountDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by warehouse' })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional({ enum: InventoryCountStatus })
  @IsOptional()
  @IsEnum(InventoryCountStatus)
  status?: InventoryCountStatus;

  @ApiPropertyOptional({ enum: InventoryCountType })
  @IsOptional()
  @IsEnum(InventoryCountType)
  countType?: InventoryCountType;
}
