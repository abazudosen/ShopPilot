import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  async create(@Body() dto: CreateTicketDto, @CurrentUser('id') userId?: string) {
    return this.ticketsService.create(dto, userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findMine(@CurrentUser('id') userId: string) {
    return this.ticketsService.findByUser(userId);
  }
}
