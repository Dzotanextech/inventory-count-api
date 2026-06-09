import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDecimal, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCountItemDto {
  @ApiProperty({ example: '95.0000', description: 'Physically counted quantity' })
  @IsDecimal({ decimal_digits: '0,4' })
  physicalQty: string;

  @ApiPropertyOptional({ description: 'Reason code for variance (DAMAGED, EXPIRED, THEFT, etc.)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reason?: string;

  @ApiPropertyOptional({ description: 'Additional remarks' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
