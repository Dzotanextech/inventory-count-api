import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsUUID, IsInt, IsBoolean, IsOptional, Min, MaxLength, MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRackDto {
  @ApiProperty({ description: 'Parent zone ID' })
  @IsUUID()
  zoneId: string;

  @ApiProperty({ example: 'R-001', description: 'Rack code (unique within zone)' })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  rackCode: string;

  @ApiProperty({ example: 'RACK-WH001-A-001', description: 'Unique barcode for scanning' })
  @IsString()
  @MaxLength(100)
  barcode: string;

  @ApiPropertyOptional({ example: 5, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  binCount?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
