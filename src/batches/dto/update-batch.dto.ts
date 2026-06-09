import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateBatchDto } from './create-batch.dto';

export class UpdateBatchDto extends PartialType(OmitType(CreateBatchDto, ['productId'] as const)) {}
