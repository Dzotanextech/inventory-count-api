import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsUUID, IsBoolean, IsOptional, IsDecimal, MaxLength, MinLength,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ description: 'Category ID' })
  @IsUUID()
  categoryId: string;

  @ApiProperty({ example: 'SKU-001234', description: 'Unique SKU code' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  sku: string;

  @ApiProperty({ example: '8901234567890', description: 'EAN/UPC barcode' })
  @IsString()
  @MaxLength(50)
  barcode: string;

  @ApiProperty({ example: 'Industrial Bearing 6205-2RS' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ example: 'Deep groove ball bearing, 52mm OD' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ example: 'PCS', description: 'Unit of measure (PCS, KG, LTR, BOX)' })
  @IsString()
  @MaxLength(20)
  uom: string;

  @ApiProperty({ example: '12.50', description: 'Cost price (decimal string)' })
  @IsDecimal({ decimal_digits: '0,4' })
  costPrice: string;

  @ApiProperty({ example: '18.00', description: 'Selling price (decimal string)' })
  @IsDecimal({ decimal_digits: '0,4' })
  sellingPrice: string;

  @ApiPropertyOptional({ default: false, description: 'Whether product is tracked by batch/lot' })
  @IsOptional()
  @IsBoolean()
  isBatchTracked?: boolean;
}
