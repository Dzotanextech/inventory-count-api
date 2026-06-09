import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveRejectDto {
  @ApiPropertyOptional({ description: 'Remarks / reason', example: 'All variances within threshold' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remarks?: string;
}
