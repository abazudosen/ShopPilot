import { IsEmail, IsString, MinLength, IsEnum } from 'class-validator';
import { Role } from '../../prisma/client';

export class SignupDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsEnum(Role)
  role: Role;
}
