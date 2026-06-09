import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'SUPERVISOR' })
  @IsString()
  @MinLength(2)
  name!: string;
}
