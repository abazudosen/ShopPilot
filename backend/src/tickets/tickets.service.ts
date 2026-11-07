import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTicketDto, userId?: string) {
    return this.prisma.supportTicket.create({
      data: {
        subject: dto.subject,
        message: dto.message,
        orderId: dto.orderId ?? null,
        email: dto.email ?? null,
        userId: userId ?? null,
      },
    });
  }

  async findByUser(userId: string) {
    return this.prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
