import { Injectable } from "@nestjs/common";
import { Prisma } from "../prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class WebhooksService {
  constructor(private readonly prisma: PrismaService) {}

  async receive(input: {
    provider: string;
    eventId: string;
    eventType: string;
    payload: Prisma.InputJsonValue;
  }) {
    const existing = await this.prisma.webhookReceipt.findUnique({
      where: {
        provider_eventId: {
          provider: input.provider,
          eventId: input.eventId,
        },
      },
    });
    if (existing) {
      await this.prisma.webhookReceipt.update({
        where: { id: existing.id },
        data: { deliveryAttempts: { increment: 1 } },
      });
      return { duplicate: true, status: existing.status };
    }

    try {
      const receipt = await this.prisma.webhookReceipt.create({
        data: {
          provider: input.provider,
          eventId: input.eventId,
          eventType: input.eventType,
          payload: input.payload,
        },
        select: { id: true, status: true },
      });
      return { duplicate: false, ...receipt };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const duplicate = await this.prisma.webhookReceipt.findUniqueOrThrow({
          where: {
            provider_eventId: {
              provider: input.provider,
              eventId: input.eventId,
            },
          },
          select: { status: true },
        });
        await this.prisma.webhookReceipt.update({
          where: {
            provider_eventId: {
              provider: input.provider,
              eventId: input.eventId,
            },
          },
          data: { deliveryAttempts: { increment: 1 } },
        });
        return { duplicate: true, status: duplicate.status };
      }
      throw error;
    }
  }
}
