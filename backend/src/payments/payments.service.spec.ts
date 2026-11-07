import { ConfigService } from "@nestjs/config";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import Stripe from "stripe";
import { PrismaService } from "../prisma/prisma.service";
import { OrdersService } from "../orders/orders.service";
import { PaymentsService } from "./payments.service";

type AsyncMockFunction = (...args: unknown[]) => Promise<unknown>;

function createTransactionClient() {
  return {
    order: {
      findUnique: jest.fn<AsyncMockFunction>().mockResolvedValue({
        id: "order-1",
        userId: "user-1",
        status: "payment_pending",
        total: 25,
        stripeCheckoutSessionId: null,
        user: { email: "buyer@example.test", name: "Buyer" },
        items: [
          {
            productId: "product-1",
            quantity: 2,
            price: 12.5,
            product: { name: "Headphones" },
          },
        ],
      }),
      update: jest.fn<AsyncMockFunction>().mockResolvedValue({}),
    },
    webhookReceipt: {
      findUnique: jest.fn<AsyncMockFunction>().mockResolvedValue(null),
      create: jest
        .fn<AsyncMockFunction>()
        .mockResolvedValue({ id: "receipt-1" }),
      update: jest.fn<AsyncMockFunction>().mockResolvedValue({}),
    },
    outboxEvent: {
      createMany: jest.fn<AsyncMockFunction>().mockResolvedValue({ count: 1 }),
    },
  };
}

type TransactionClient = ReturnType<typeof createTransactionClient>;
type TransactionCallback = (
  callback: (transaction: TransactionClient) => Promise<unknown>,
) => Promise<unknown>;

describe("PaymentsService", () => {
  const paidSession = {
    id: "cs_test_123",
    mode: "payment",
    payment_status: "paid",
    amount_total: 2500,
    currency: "usd",
    metadata: { orderId: "order-1", userId: "user-1" },
    payment_intent: "pi_test_123",
  };
  let prisma: {
    $transaction: jest.Mock<TransactionCallback>;
    order: {
      findUnique: jest.Mock<AsyncMockFunction>;
      updateMany: jest.Mock<AsyncMockFunction>;
    };
    webhookReceipt: { findUnique: jest.Mock<AsyncMockFunction> };
  };
  let transactionClient: TransactionClient;
  let ordersService: { findByIdForUser: jest.Mock<AsyncMockFunction> };
  let service: PaymentsService;

  beforeEach(() => {
    transactionClient = createTransactionClient();
    prisma = {
      $transaction: jest.fn<TransactionCallback>((callback) =>
        callback(transactionClient),
      ),
      order: {
        findUnique: jest.fn<AsyncMockFunction>(),
        updateMany: jest
          .fn<AsyncMockFunction>()
          .mockResolvedValue({ count: 1 }),
      },
      webhookReceipt: { findUnique: jest.fn<AsyncMockFunction>() },
    };
    ordersService = { findByIdForUser: jest.fn<AsyncMockFunction>() };
    service = new PaymentsService(
      { get: jest.fn() } as unknown as ConfigService,
      prisma as unknown as PrismaService,
      ordersService as unknown as OrdersService,
    );
  });

  it("marks the order paid and enqueues purchase history after verified payment", async () => {
    const event = {
      id: "evt_test_123",
      type: "checkout.session.completed",
      data: { object: paidSession },
    } as unknown as Stripe.Event;

    await expect(service.processStripeEvent(event)).resolves.toEqual({
      duplicate: false,
      status: "PROCESSED",
    });
    expect(transactionClient.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order-1" },
        data: expect.objectContaining({
          status: "paid",
          stripeCheckoutSessionId: "cs_test_123",
        }),
      }),
    );
    expect(transactionClient.outboxEvent.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          type: "PURCHASE_HISTORY",
          payload: {
            userId: "user-1",
            productId: "product-1",
            quantity: 2,
          },
        }),
        expect.objectContaining({
          type: "ORDER_CONFIRMATION_EMAIL",
          payload: {
            orderId: "order-1",
            email: "buyer@example.test",
            name: "Buyer",
            total: 25,
            items: [{ name: "Headphones", quantity: 2, price: 12.5 }],
          },
        }),
      ]),
    });
  });

  it("does not enqueue purchase history for duplicate Stripe events", async () => {
    transactionClient.webhookReceipt.findUnique.mockResolvedValue({
      id: "receipt-1",
      status: "PROCESSED",
    });
    const event = {
      id: "evt_test_123",
      type: "checkout.session.completed",
      data: { object: paidSession },
    } as unknown as Stripe.Event;

    await expect(service.processStripeEvent(event)).resolves.toEqual({
      duplicate: true,
      status: "PROCESSED",
    });
    expect(transactionClient.order.findUnique).not.toHaveBeenCalled();
    expect(transactionClient.outboxEvent.createMany).not.toHaveBeenCalled();
  });

  it("cancels an unpaid order with an ownership-scoped update", async () => {
    const pending = {
      id: "order-1",
      userId: "user-1",
      status: "payment_pending",
      stripeCheckoutSessionId: null,
    };
    const cancelled = { ...pending, status: "cancelled" };
    ordersService.findByIdForUser
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(cancelled);

    await expect(service.cancelOrder("order-1", "user-1")).resolves.toBe(
      cancelled,
    );
    expect(prisma.order.updateMany).toHaveBeenCalledWith({
      where: {
        id: "order-1",
        userId: "user-1",
        status: {
          in: [
            "pending",
            "payment_pending",
            "payment_failed",
            "payment_expired",
          ],
        },
        stripeCheckoutSessionId: null,
      },
      data: { status: "cancelled" },
    });
  });
});
