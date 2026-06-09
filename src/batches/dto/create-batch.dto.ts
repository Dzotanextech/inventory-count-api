import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateBatchDto {
  @ApiProperty({ description: 'Product ID' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 'BATCH-2024-001' })
  @IsString()
  @MaxLength(100)
  batchNumber: string;

  @ApiPropertyOptional({ example: '2024-01-15', description: 'ISO date string' })
  @IsOptional()
  @IsDateString()
  manufacturingDate?: string;

  @ApiPropertyOptional({ example: '2026-01-15', description: 'ISO date string' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}
