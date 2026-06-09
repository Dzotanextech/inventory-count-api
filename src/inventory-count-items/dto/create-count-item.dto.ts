import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDecimal, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateCountItemDto {
  @ApiProperty({ description: 'Inventory count ID' })
  @IsUUID()
  inventoryCountId: string;

  @ApiProperty({ description: 'Product ID' })
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({ description: 'Batch ID (for batch-tracked products)' })
  @IsOptional()
  @IsUUID()
  batchId?: string;

  @ApiPropertyOptional({ description: 'Rack ID' })
  @IsOptional()
  @IsUUID()
  rackId?: string;

  @ApiProperty({ example: '0.0000', description: 'System quantity from inventory records' })
  @IsDecimal({ decimal_digits: '0,4' })
  systemQty: string;
}
