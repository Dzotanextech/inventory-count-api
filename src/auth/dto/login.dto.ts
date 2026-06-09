import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@warehouse.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Password@123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;
}
