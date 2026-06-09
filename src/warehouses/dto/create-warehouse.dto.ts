import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateWarehouseDto {
  @ApiProperty({ example: 'WH-001', description: 'Unique warehouse code' })
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  code: string;

  @ApiProperty({ example: 'Main Distribution Center' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: '123 Logistics Park, Industrial Zone, City 10001' })
  @IsString()
  @MaxLength(500)
  address: string;
}
