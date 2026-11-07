import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma } from "../prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateOrderDto } from "./dto/create-order.dto";

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOrderDto, userId: string, idempotencyKey?: string) {
    const key = idempotencyKey?.trim();
    if (!key || key.length > 255) {
      throw new BadRequestException(
        "A non-empty Idempotency-Key header of at most 255 characters is required",
      );
    }

    const quantities = new Map<string, number>();
    for (const item of dto.items) {
      const quantity = (quantities.get(item.productId) ?? 0) + item.quantity;
      if (quantity > 99) {
        throw new BadRequestException("A product quantity cannot exceed 99");
      }
      quantities.set(item.productId, quantity);
    }
    const items = [...quantities.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([productId, quantity]) => ({ productId, quantity }));
    const requestHash = createHash("sha256")
      .update(JSON.stringify(items))
      .digest("hex");
    const existing = await this.findIdempotentOrder(userId, key);
    if (existing) {
      this.assertSameRequest(existing.requestHash, requestHash);
      return existing;
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const products = await tx.product.findMany({
          where: { id: { in: items.map((item) => item.productId) } },
        });
        const productsById = new Map(
          products.map((product) => [product.id, product]),
        );
        if (productsById.size !== items.length) {
          throw new BadRequestException("One or more products are unavailable");
        }

        const now = new Date();
        const pricedItems = items.map((item) => {
          const product = productsById.get(item.productId)!;
          if (!product.inStock) {
            throw new BadRequestException(
              `Product "${product.name}" is out of stock`,
            );
          }
          const regularPrice = Number(product.price);
          const salePrice =
            product.salePrice == null ? null : Number(product.salePrice);
          const isDeal =
            salePrice != null &&
            salePrice < regularPrice &&
            (!product.dealExpiresAt || product.dealExpiresAt > now);
          return {
            ...item,
            price: isDeal ? salePrice : regularPrice,
          };
        });
        const total = pricedItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0,
        );

        const order = await tx.order.create({
          data: {
            userId,
            total,
            status: "payment_pending",
            idempotencyKey: key,
            requestHash,
            items: {
              create: pricedItems.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                price: item.price,
              })),
            },
          },
          include: { items: { include: { product: true } } },
        });
        return order;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const concurrentOrder = await this.findIdempotentOrder(userId, key);
        if (concurrentOrder) {
          this.assertSameRequest(concurrentOrder.requestHash, requestHash);
          return concurrentOrder;
        }
      }
      throw error;
    }
  }

  private findIdempotentOrder(userId: string, idempotencyKey: string) {
    return this.prisma.order.findUnique({
      where: {
        userId_idempotencyKey: { userId, idempotencyKey },
      },
      include: { items: { include: { product: true } } },
    });
  }

  private assertSameRequest(
    storedHash: string | null,
    requestHash: string,
  ): void {
    if (storedHash !== requestHash) {
      throw new ConflictException(
        "This Idempotency-Key was already used with a different order",
      );
    }
  }

  async findByUserId(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: string) {
    return this.prisma.order.findUnique({
      where: { id },
      include: { items: { include: { product: true } } },
    });
  }

  async findByIdForUser(id: string, userId: string) {
    const order = await this.findById(id);
    if (!order) {
      throw new NotFoundException(`Order with id "${id}" not found`);
    }
    if (order.userId !== userId) {
      throw new ForbiddenException("You can only view your own orders");
    }
    return order;
  }

  async findPaymentStatus(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true, status: true },
    });
    if (!order) {
      throw new NotFoundException(`Order "${orderId}" not found`);
    }
    if (order.userId !== userId) {
      throw new ForbiddenException("You can only view your own orders");
    }
    return { id: order.id, status: order.status };
  }

  async findRecentByUserId(userId: string, take = 5) {
    return this.prisma.order.findMany({
      where: { userId },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: "desc" },
      take,
    });
  }
}
