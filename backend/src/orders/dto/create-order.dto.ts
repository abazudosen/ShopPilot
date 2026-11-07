import {
  IsString,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  Max,
  ArrayMaxSize,
  ArrayMinSize,
} from "class-validator";
import { Type } from "class-transformer";

class OrderItemDto {
  @IsString()
  productId: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity: number;
}

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
