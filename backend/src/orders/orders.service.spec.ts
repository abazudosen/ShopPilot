import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { OrdersService } from "./orders.service";

type ProductRecord = {
  id: string;
  name: string;
  price: number;
  salePrice: number | null;
  dealExpiresAt: Date | null;
  inStock: boolean;
};

describe("OrdersService", () => {
  const items = [{ productId: "product-1", quantity: 2 }];
  const dto = { items };
  const requestHash = createHash("sha256")
    .update(JSON.stringify(items))
    .digest("hex");
  let prisma: {
    order: {
      findUnique: jest.MockedFunction<
        (args?: unknown) => Promise<{ id: string; requestHash: string } | null>
      >;
    };
    $transaction: jest.MockedFunction<
      (callback: (tx: typeof transactionClient) => unknown) => Promise<unknown>
    >;
  };
  let transactionClient: {
    product: {
      findMany: jest.MockedFunction<
        (args?: unknown) => Promise<ProductRecord[]>
      >;
    };
    order: {
      create: jest.MockedFunction<(args?: unknown) => Promise<unknown>>;
    };
  };
  let service: OrdersService;

  beforeEach(() => {
    transactionClient = {
      product: {
        findMany: jest.fn<() => Promise<ProductRecord[]>>().mockResolvedValue([
          {
            id: "product-1",
            name: "Product",
            price: 20,
            salePrice: 12.5,
            dealExpiresAt: null,
            inStock: true,
          },
        ]),
      },
      order: { create: jest.fn<() => Promise<unknown>>() },
    };
    prisma = {
      order: {
        findUnique: jest
          .fn<() => Promise<{ id: string; requestHash: string } | null>>()
          .mockResolvedValue(null),
      },
      $transaction: jest.fn<
        (
          callback: (tx: typeof transactionClient) => unknown,
        ) => Promise<unknown>
      >((callback) => Promise.resolve(callback(transactionClient))),
    };
    service = new OrdersService(prisma as unknown as PrismaService);
  });

  it("requires an idempotency key", async () => {
    await expect(service.create(dto, "user-1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.order.findUnique).not.toHaveBeenCalled();
  });

  it("returns the original order when the same key and payload are retried", async () => {
    const existing = { id: "order-1", requestHash };
    prisma.order.findUnique.mockResolvedValue(existing);

    await expect(service.create(dto, "user-1", "request-1")).resolves.toBe(
      existing,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects reuse of a key with a different payload", async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      requestHash: "different-hash",
    });

    await expect(
      service.create(dto, "user-1", "request-1"),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("uses catalog prices and creates a pending order without purchase events", async () => {
    const order = { id: "order-1", items: [] };
    transactionClient.order.create.mockResolvedValue(order);

    await expect(service.create(dto, "user-1", "request-1")).resolves.toBe(
      order,
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transactionClient.product.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["product-1"] } },
    });
    expect(transactionClient.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          status: "payment_pending",
          idempotencyKey: "request-1",
          requestHash,
          total: 25,
          items: {
            create: [{ productId: "product-1", quantity: 2, price: 12.5 }],
          },
        }),
      }),
    );
  });

  it("rejects orders with missing or out-of-stock products", async () => {
    transactionClient.product.findMany.mockResolvedValue([]);
    await expect(
      service.create(dto, "user-1", "request-1"),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transactionClient.order.create).not.toHaveBeenCalled();

    transactionClient.product.findMany.mockResolvedValue([
      {
        id: "product-1",
        name: "Product",
        price: 20,
        salePrice: null,
        dealExpiresAt: null,
        inStock: false,
      },
    ]);
    await expect(
      service.create(dto, "user-1", "request-2"),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transactionClient.order.create).not.toHaveBeenCalled();
  });
});
