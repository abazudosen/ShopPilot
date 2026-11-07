import {
  IsString,
  IsArray,
  ValidateNested,
  IsIn,
  IsOptional,
  IsNumber,
  MaxLength,
  Min,
  ArrayMaxSize,
  IsInt,
} from "class-validator";
import { Type } from "class-transformer";

class HistoryMessageDto {
  @IsIn(["user", "assistant"])
  role: "user" | "assistant";

  @IsString()
  @MaxLength(4_000)
  content: string;
}

class CartLineDto {
  @IsString()
  @MaxLength(100)
  productId: string;

  @IsString()
  @MaxLength(200)
  name: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsInt()
  quantity: number;
}

export class ChatMessageDto {
  @IsString()
  @MaxLength(2_000)
  message: string;

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => HistoryMessageDto)
  history: HistoryMessageDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CartLineDto)
  cart?: CartLineDto[];
}
