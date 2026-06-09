import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDecimal, IsOptional, IsUUID } from 'class-validator';

export class CreateInventoryLocationDto {
  @ApiProperty({ description: 'Warehouse ID' })
  @IsUUID()
  warehouseId: string;

  @ApiPropertyOptional({ description: 'Rack ID (nullable)' })
  @IsOptional()
  @IsUUID()
  rackId?: string;

  @ApiProperty({ description: 'Product ID' })
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({ description: 'Batch ID (nullable for non-batch-tracked products)' })
  @IsOptional()
  @IsUUID()
  batchId?: string;

  @ApiProperty({ example: '100.0000' })
  @IsDecimal({ decimal_digits: '0,4' })
  quantity: string;
}
