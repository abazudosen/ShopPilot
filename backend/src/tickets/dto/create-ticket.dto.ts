import { IsString, IsOptional, IsEmail, MaxLength, MinLength } from 'class-validator';

export class CreateTicketDto {
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  subject: string;

  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  message: string;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
