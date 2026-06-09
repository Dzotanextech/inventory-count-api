import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDecimal, IsOptional, IsString, IsUUID } from 'class-validator';

export class ScanProductDto {
  @ApiProperty({ description: 'Inventory count ID' })
  @IsUUID()
  inventoryCountId: string;

  @ApiProperty({ description: 'Product or rack barcode scanned' })
  @IsString()
  barcode: string;

  @ApiProperty({ example: '10.0000', description: 'Quantity counted during scan' })
  @IsDecimal({ decimal_digits: '0,4' })
  physicalQty: string;

  @ApiPropertyOptional({ description: 'Batch ID if product is batch-tracked' })
  @IsOptional()
  @IsUUID()
  batchId?: string;

  @ApiPropertyOptional({ description: 'Remarks for this scan' })
  @IsOptional()
  @IsString()
  remarks?: string;
}
