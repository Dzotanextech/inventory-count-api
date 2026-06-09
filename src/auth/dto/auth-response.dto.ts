import { ApiProperty } from '@nestjs/swagger';

export class AuthUserDto {
  @ApiProperty({ example: 'uuid-here' })
  id: string;

  @ApiProperty({ example: 'John Smith' })
  name: string;

  @ApiProperty({ example: 'john@warehouse.com' })
  email: string;

  @ApiProperty({ example: 'SUPER_ADMIN' })
  role: string;
}

export class TokensDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ example: 'f97b3a46-d0ca-40a3-bfcd-bdbb3963c364' })
  refreshToken: string;

  @ApiProperty({ example: 900, description: 'Access token TTL in seconds' })
  expiresIn: number;
}

export class AuthResponseDto {
  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;

  @ApiProperty({ type: TokensDto })
  tokens: TokensDto;
}
