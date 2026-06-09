import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateRackDto } from './create-rack.dto';

export class UpdateRackDto extends PartialType(OmitType(CreateRackDto, ['zoneId'] as const)) {}
