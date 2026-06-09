import { ApiProperty } from '@nestjs/swagger';
import { IsDecimal } from 'class-validator';

export class UpdateInventoryLocationDto {
  @ApiProperty({ example: '150.0000' })
  @IsDecimal({ decimal_digits: '0,4' })
  quantity: string;
}
