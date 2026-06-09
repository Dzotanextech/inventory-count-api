import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  IsArray,
  MaxLength,
} from 'class-validator';
import { InventoryCountType } from '@prisma/client';

export class CreateInventoryCountDto {
  @ApiProperty({ description: 'Warehouse to count' })
  @IsUUID()
  warehouseId: string;

  @ApiProperty({ enum: InventoryCountType, example: InventoryCountType.FULL })
  @IsEnum(InventoryCountType)
  countType: InventoryCountType;

  @ApiProperty({ example: '2024-06-15', description: 'Scheduled count date' })
  @IsDateString()
  countDate: string;

  @ApiPropertyOptional({ example: '2024-06-16', description: 'Due date for completion' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Optional notes' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  // Optional filters (used based on countType)
  @ApiPropertyOptional({ description: 'Category ID (for CATEGORY type counts)' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Product IDs (for PRODUCT type counts)', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  productIds?: string[];

  @ApiPropertyOptional({ description: 'Rack IDs (for RACK type counts)', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  rackIds?: string[];
}
