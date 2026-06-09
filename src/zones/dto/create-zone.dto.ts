import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateZoneDto {
  @ApiProperty({ description: 'Parent warehouse ID' })
  @IsUUID()
  warehouseId: string;

  @ApiProperty({ example: 'A', description: 'Zone code (unique within warehouse)' })
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  code: string;

  @ApiProperty({ example: 'Zone A - Ambient Storage' })
  @IsString()
  @MaxLength(100)
  name: string;
}
