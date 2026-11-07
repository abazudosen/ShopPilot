import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "../prisma/client";
import Stripe from "stripe";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { OrdersService } from "../orders/orders.service";
import { CreateOrderDto } from "../orders/dto/create-order.dto";

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private stripeClient?: Stripe;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
  ) {}

  async createCheckout(
    dto: CreateOrderDto,
    userId: string,
    idempotencyKey?: string,
  ) {
    if (!idempotencyKey?.trim() || idempotencyKey.length > 255) {
      throw new BadRequestException(
        "A non-empty Idempotency-Key header of at most 255 characters is required",
      );
    }
    const stripe = this.getStripe();
    const origin = this.getFrontendOrigin();
    let order = await this.ordersService.create(dto, userId, idempotencyKey);
    if (order.status === "paid") {
      throw new ConflictException("This order has already been paid");
    }
    if (
      !["payment_pending", "payment_failed", "payment_expired"].includes(
        order.status,
      )
    ) {
      throw new ConflictException(
        `This order cannot be checked out (status: ${order.status})`,
      );
    }
    if (order.stripeCheckoutSessionId) {
      const previousSession = await stripe.checkout.sessions.retrieve(
        order.stripeCheckoutSessionId,
      );
      if (previousSession.status === "open" && previousSession.url) {
        return { orderId: order.id, checkoutUrl: previousSession.url };
      }
      if (
        previousSession.status === "complete" &&
        order.status !== "payment_failed"
      ) {
        throw new ConflictException(
          "Payment is processing; refresh the order status shortly",
        );
      }

      order = await this.prisma.order.update({
        where: { id: order.id },
        data: {
          checkoutAttempt: { increment: 1 },
          stripeCheckoutSessionId: null,
          status: "payment_pending",
        },
        include: { items: { include: { product: true } } },
      });
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        allowed_payment_method_types: ["card"],
        line_items: order.items.map((item) => ({
          quantity: item.quantity,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(Number(item.price) * 100),
            product_data: {
              name: item.product.name,
              description: item.product.description.slice(0, 500),
            },
          },
        })),
        client_reference_id: order.id,
        metadata: { orderId: order.id, userId },
        payment_intent_data: {
          metadata: { orderId: order.id, userId },
        },
        success_url: `${origin}/checkout/success?order_id=${encodeURIComponent(order.id)}`,
        cancel_url: `${origin}/checkout/cancel?order_id=${encodeURIComponent(order.id)}`,
      },
      { idempotencyKey: `checkout-${order.id}-${order.checkoutAttempt}` },
    );
    if (!session.url) {
      throw new ServiceUnavailableException(
        "Stripe did not return a checkout URL",
      );
    }

    const stored = await this.prisma.order.updateMany({
      where: {
        id: order.id,
        status: "payment_pending",
        stripeCheckoutSessionId: null,
      },
      data: { stripeCheckoutSessionId: session.id },
    });
    if (stored.count === 0) {
      const current = await this.prisma.order.findUnique({
        where: { id: order.id },
        select: { status: true },
      });
      if (current?.status === "cancelled") {
        if (session.status === "open") {
          await stripe.checkout.sessions.expire(session.id);
        }
        throw new ConflictException(
          "The order was cancelled before checkout could be completed",
        );
      }
    }
    return { orderId: order.id, checkoutUrl: session.url };
  }

  async cancelOrder(orderId: string, userId: string) {
    const order = await this.ordersService.findByIdForUser(orderId, userId);
    if (order.status === "cancelled") return order;
    if (
      ![
        "pending",
        "payment_pending",
        "payment_failed",
        "payment_expired",
      ].includes(order.status)
    ) {
      throw new ConflictException(
        `Order can no longer be cancelled (status: ${order.status})`,
      );
    }

    if (order.status === "payment_pending" && order.stripeCheckoutSessionId) {
      const stripe = this.getStripe();
      const session = await stripe.checkout.sessions.retrieve(
        order.stripeCheckoutSessionId,
      );
      if (session.status === "complete") {
        throw new ConflictException(
          "Payment is processing; the order cannot be cancelled yet",
        );
      }
      if (session.status === "open") {
        await stripe.checkout.sessions.expire(order.stripeCheckoutSessionId);
      }
    }

    const updated = await this.prisma.order.updateMany({
      where: {
        id: order.id,
        userId,
        status: {
          in: [
            "pending",
            "payment_pending",
            "payment_failed",
            "payment_expired",
          ],
        },
        stripeCheckoutSessionId: order.stripeCheckoutSessionId,
      },
      data: { status: "cancelled" },
    });
    if (updated.count === 0) {
      const latest = await this.ordersService.findByIdForUser(orderId, userId);
      if (latest.status === "cancelled") return latest;
      throw new ConflictException(
        `Order can no longer be cancelled (status: ${latest.status})`,
      );
    }
    return this.ordersService.findByIdForUser(orderId, userId);
  }

  async processStripeEvent(event: Stripe.Event) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.webhookReceipt.findUnique({
          where: {
            provider_eventId: { provider: "stripe", eventId: event.id },
          },
        });
        if (existing) {
          await tx.webhookReceipt.update({
            where: { id: existing.id },
            data: { deliveryAttempts: { increment: 1 } },
          });
          return { duplicate: true, status: existing.status };
        }

        const receipt = await tx.webhookReceipt.create({
          data: {
            provider: "stripe",
            eventId: event.id,
            eventType: event.type,
            payload: event.data.object as unknown as Prisma.InputJsonValue,
          },
        });

        if (
          event.type === "checkout.session.completed" ||
          event.type === "checkout.session.async_payment_succeeded"
        ) {
          const session = event.data.object as Stripe.Checkout.Session;
          if (session.payment_status === "paid") {
            await this.completePaidSession(tx, session);
            await tx.webhookReceipt.update({
              where: { id: receipt.id },
              data: { status: "PROCESSED" },
            });
            return { duplicate: false, status: "PROCESSED" };
          }
        } else if (
          event.type === "checkout.session.expired" ||
          event.type === "checkout.session.async_payment_failed"
        ) {
          const session = event.data.object as Stripe.Checkout.Session;
          const orderId = session.metadata?.orderId;
          if (orderId) {
            const order = await tx.order.findUnique({
              where: { id: orderId },
            });
            if (
              order &&
              order.status !== "paid" &&
              order.status !== "cancelled" &&
              (!order.stripeCheckoutSessionId ||
                order.stripeCheckoutSessionId === session.id)
            ) {
              await tx.order.update({
                where: { id: order.id },
                data: {
                  status:
                    event.type === "checkout.session.expired"
                      ? "payment_expired"
                      : "payment_failed",
                },
              });
            }
          }
          await tx.webhookReceipt.update({
            where: { id: receipt.id },
            data: { status: "PROCESSED" },
          });
          return { duplicate: false, status: "PROCESSED" };
        }

        await tx.webhookReceipt.update({
          where: { id: receipt.id },
          data: { status: "IGNORED" },
        });
        return { duplicate: false, status: "IGNORED" };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const receipt = await this.prisma.webhookReceipt.findUnique({
          where: {
            provider_eventId: { provider: "stripe", eventId: event.id },
          },
          select: { status: true },
        });
        if (receipt) {
          return { duplicate: true, status: receipt.status };
        }
      }
      throw error;
    }
  }

  verifyWebhook(rawBody: Buffer, signature: string): Stripe.Event {
    const secret = this.config.get<string>("STRIPE_WEBHOOK_SECRET");
    if (!secret) {
      throw new ServiceUnavailableException(
        "Stripe webhooks are not configured",
      );
    }
    try {
      return this.getStripe().webhooks.constructEvent(
        rawBody,
        signature,
        secret,
      );
    } catch (error) {
      this.logger.warn(`Stripe webhook signature verification failed`);
      throw new BadRequestException("Invalid Stripe webhook signature", {
        cause: error,
      });
    }
  }

  private async completePaidSession(
    tx: Prisma.TransactionClient,
    session: Stripe.Checkout.Session,
  ) {
    const orderId = session.metadata?.orderId;
    const userId = session.metadata?.userId;
    if (
      !orderId ||
      !userId ||
      session.mode !== "payment" ||
      session.payment_status !== "paid" ||
      session.amount_total == null ||
      session.currency !== "usd"
    ) {
      throw new BadRequestException("Stripe paid session has invalid metadata");
    }
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { email: true, name: true } },
        items: { include: { product: { select: { name: true } } } },
      },
    });
    if (!order || order.userId !== userId) {
      throw new BadRequestException(
        "Stripe paid session does not match an order",
      );
    }
    if (
      order.stripeCheckoutSessionId &&
      order.stripeCheckoutSessionId !== session.id
    ) {
      throw new ConflictException("Stripe session does not match the order");
    }
    if (Math.round(Number(order.total) * 100) !== session.amount_total) {
      throw new BadRequestException("Stripe payment amount does not match");
    }
    if (order.status === "paid") return;
    if (order.status === "cancelled") {
      throw new ConflictException("A cancelled order cannot be paid");
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "paid",
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : (session.payment_intent?.id ?? null),
      },
    });
    await tx.outboxEvent.createMany({
      data: [
        ...order.items.map((item) => ({
          id: randomUUID(),
          type: "PURCHASE_HISTORY",
          payload: {
            userId: order.userId,
            productId: item.productId,
            quantity: item.quantity,
          },
          updatedAt: new Date(),
        })),
        {
          id: randomUUID(),
          type: "ORDER_CONFIRMATION_EMAIL",
          payload: {
            orderId: order.id,
            email: order.user.email,
            name: order.user.name,
            total: Number(order.total),
            items: order.items.map((item) => ({
              name: item.product.name,
              quantity: item.quantity,
              price: Number(item.price),
            })),
          },
          updatedAt: new Date(),
        },
      ],
    });
  }

  private getStripe() {
    if (this.stripeClient) return this.stripeClient;
    const secretKey = this.config.get<string>("STRIPE_SECRET_KEY");
    if (!secretKey?.startsWith("sk_test_")) {
      throw new ServiceUnavailableException(
        "Stripe demo payments require a Stripe test secret key (sk_test_...)",
      );
    }
    this.stripeClient = new Stripe(secretKey, {
      timeout: 15_000,
      maxNetworkRetries: 2,
    });
    return this.stripeClient;
  }

  private getFrontendOrigin() {
    const frontendUrl = this.config
      .get<string>("FRONTEND_URL", "http://localhost:5173")
      .replace(/\/+$/, "");
    try {
      const parsed = new URL(frontendUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("Unsupported protocol");
      }
      return parsed.origin;
    } catch {
      throw new ServiceUnavailableException(
        "FRONTEND_URL must be an absolute HTTP(S) URL",
      );
    }
  }
}
