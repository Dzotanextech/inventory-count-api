import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateZoneDto } from './create-zone.dto';

export class UpdateZoneDto extends PartialType(OmitType(CreateZoneDto, ['warehouseId'] as const)) {}
