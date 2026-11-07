import { IsEnum, IsOptional, IsString, IsInt, Min } from 'class-validator';
import { EventType } from '../../prisma/client';

export class RecordEventDto {
  @IsEnum(EventType)
  type: EventType;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}
