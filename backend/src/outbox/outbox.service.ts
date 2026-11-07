import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Job, Queue, Worker, type ConnectionOptions } from "bullmq";
import { metrics, trace } from "@opentelemetry/api";
import { Prisma } from "../prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService, type OrderConfirmationEmail } from "./email.service";

const QUEUE_NAME = "background-jobs";
const JOB_NAME = "outbox-event";
const POLL_INTERVAL_MS = 2_000;
const CLAIM_TIMEOUT_MS = 60_000;
const MAX_ATTEMPTS = 5;
const outboxMeter = metrics.getMeter("shopping-background-jobs");
const tracer = trace.getTracer("shopping-background-jobs");

interface OutboxJob {
  outboxEventId: string;
}

interface PurchaseHistoryPayload {
  userId: string;
  productId: string;
  quantity: number;
}

interface OutboxEventRecord {
  id: string;
  type: string;
  payload: Prisma.JsonValue;
  status: string;
}

@Injectable()
export class OutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxService.name);
  private readonly queue: Queue<OutboxJob>;
  private readonly worker: Worker<OutboxJob>;
  private pollTimer: NodeJS.Timeout | undefined;
  private polling = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {
    const pendingGauge = outboxMeter.createObservableGauge("outbox.events");
    pendingGauge.addCallback(async (result) => {
      for (const status of ["PENDING", "ENQUEUED", "FAILED"]) {
        const count = await this.prisma.outboxEvent.count({
          where: { status },
        });
        result.observe(count, { status });
      }
    });
    const connection = redisConnection();
    this.queue = new Queue<OutboxJob>(QUEUE_NAME, { connection });
    this.worker = new Worker<OutboxJob>(
      QUEUE_NAME,
      (job) => this.processJob(job),
      { connection },
    );
    this.worker.on("error", (error) => {
      this.logger.error(`Background worker error: ${error.message}`);
    });
    this.worker.on("failed", (job, error) => {
      if (!job) return;
      this.logger.warn(
        `Background job ${job.id} attempt ${job.attemptsMade} failed: ${error.message}`,
      );
      if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
        void this.markDeadLetter(job.data.outboxEventId, error);
      }
    });
  }

  onModuleInit(): void {
    this.pollTimer = setInterval(
      () => void this.flushOutbox(),
      POLL_INTERVAL_MS,
    );
    void this.flushOutbox();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pollTimer) clearInterval(this.pollTimer);
    await Promise.all([this.worker.close(), this.queue.close()]);
  }

  private async flushOutbox(): Promise<void> {
    if (this.polling) return;
    this.polling = true;

    try {
      const staleClaim = new Date(Date.now() - CLAIM_TIMEOUT_MS);
      await this.prisma.outboxEvent.updateMany({
        where: { status: "PROCESSING", lockedAt: { lt: staleClaim } },
        data: { status: "PENDING", lockedAt: null },
      });

      const staleEnqueued = await this.prisma.outboxEvent.findMany({
        where: {
          status: "ENQUEUED",
          updatedAt: { lt: staleClaim },
        },
        orderBy: { updatedAt: "asc" },
        take: 25,
        select: { id: true },
      });
      for (const event of staleEnqueued) {
        const job = await this.queue.getJob(event.id);
        if (!job) {
          await this.prisma.outboxEvent.updateMany({
            where: { id: event.id, status: "ENQUEUED" },
            data: {
              status: "PENDING",
              lastError:
                "Recovered outbox event with no corresponding queue job",
            },
          });
        }
      }

      const pending = await this.prisma.outboxEvent.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        take: 25,
      });

      for (const event of pending) {
        const claimed = await this.prisma.outboxEvent.updateMany({
          where: { id: event.id, status: "PENDING" },
          data: {
            status: "PROCESSING",
            lockedAt: new Date(),
          },
        });
        if (claimed.count === 0) continue;

        try {
          await this.queue.add(
            JOB_NAME,
            { outboxEventId: event.id },
            {
              jobId: event.id,
              attempts: MAX_ATTEMPTS,
              backoff: { type: "exponential", delay: 1_000 },
              removeOnComplete: 1_000,
              removeOnFail: false,
            },
          );
          await this.prisma.outboxEvent.updateMany({
            where: { id: event.id, status: "PROCESSING" },
            data: { status: "ENQUEUED", lockedAt: null, lastError: null },
          });
        } catch (error) {
          const message = errorMessage(error);
          await this.prisma.outboxEvent.updateMany({
            where: { id: event.id, status: "PROCESSING" },
            data: { status: "PENDING", lockedAt: null, lastError: message },
          });
          this.logger.error(
            `Failed to enqueue outbox event ${event.id}: ${message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Outbox polling failed: ${errorMessage(error)}`);
    } finally {
      this.polling = false;
    }
  }

  private async processJob(job: Job<OutboxJob>): Promise<void> {
    const span = tracer.startSpan("background.outbox.process");
    span.setAttribute("messaging.system", "bullmq");
    span.setAttribute("messaging.destination.name", QUEUE_NAME);
    span.setAttribute("messaging.message.id", job.data.outboxEventId);
    try {
      const event = await this.prisma.outboxEvent.findUnique({
        where: { id: job.data.outboxEventId },
      });
      if (!event || event.status === "PROCESSED" || event.status === "FAILED") {
        return;
      }

      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: { attempts: { increment: 1 } },
      });

      await this.processEvent(event);
    } catch (error) {
      if (error instanceof Error) span.recordException(error);
      if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
        await this.markDeadLetter(job.data.outboxEventId, error);
      }
      throw error;
    } finally {
      span.end();
    }
  }

  private async processEvent(event: OutboxEventRecord): Promise<void> {
    if (event.type === "PURCHASE_HISTORY") {
      const payload = parsePurchaseHistoryPayload(event.payload);
      await this.prisma.$transaction(async (tx) => {
        await tx.userEvent.upsert({
          where: { outboxEventId: event.id },
          update: {},
          create: {
            userId: payload.userId,
            type: "PURCHASE",
            productId: payload.productId,
            quantity: payload.quantity,
            outboxEventId: event.id,
          },
        });
        await tx.outboxEvent.update({
          where: { id: event.id },
          data: { status: "PROCESSED", lockedAt: null, lastError: null },
        });
      });
      return;
    }

    if (event.type === "ORDER_CONFIRMATION_EMAIL") {
      const payload = parseOrderConfirmationEmail(event.payload);
      await this.emailService.sendOrderConfirmation(payload);
      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: { status: "PROCESSED", lockedAt: null, lastError: null },
      });
      return;
    }

    throw new Error(`Unsupported outbox event type: ${event.type}`);
  }

  private async markDeadLetter(
    outboxEventId: string,
    error: Error,
  ): Promise<void> {
    try {
      await this.prisma.outboxEvent.updateMany({
        where: { id: outboxEventId, status: "ENQUEUED" },
        data: {
          status: "FAILED",
          lockedAt: null,
          lastError: error.message.slice(0, 2_000),
        },
      });
    } catch (markError) {
      this.logger.error(
        `Could not persist dead-letter state for ${outboxEventId}: ${errorMessage(markError)}`,
      );
    }
  }
}

function parsePurchaseHistoryPayload(
  payload: Prisma.JsonValue,
): PurchaseHistoryPayload {
  if (
    payload === null ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    throw new Error("Invalid purchase-history outbox payload");
  }
  const { userId, productId, quantity } = payload as Record<string, unknown>;
  if (
    typeof userId !== "string" ||
    typeof productId !== "string" ||
    typeof quantity !== "number" ||
    !Number.isInteger(quantity) ||
    quantity < 1
  ) {
    throw new Error("Invalid purchase-history outbox payload");
  }
  return { userId, productId, quantity };
}

function parseOrderConfirmationEmail(
  payload: Prisma.JsonValue,
): OrderConfirmationEmail {
  if (
    payload === null ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    throw new Error("Invalid order-confirmation email payload");
  }
  const record = payload as Record<string, unknown>;
  if (
    typeof record.orderId !== "string" ||
    typeof record.email !== "string" ||
    typeof record.name !== "string" ||
    typeof record.total !== "number" ||
    !Number.isFinite(record.total) ||
    !Array.isArray(record.items)
  ) {
    throw new Error("Invalid order-confirmation email payload");
  }
  const items = record.items.map((item) => {
    if (
      item === null ||
      typeof item !== "object" ||
      typeof (item as Record<string, unknown>).name !== "string" ||
      typeof (item as Record<string, unknown>).quantity !== "number" ||
      typeof (item as Record<string, unknown>).price !== "number"
    ) {
      throw new Error("Invalid order-confirmation email item");
    }
    const parsed = item as { name: string; quantity: number; price: number };
    if (
      !Number.isInteger(parsed.quantity) ||
      parsed.quantity < 1 ||
      !Number.isFinite(parsed.price) ||
      parsed.price < 0
    ) {
      throw new Error("Invalid order-confirmation email item");
    }
    return parsed;
  });
  return {
    orderId: record.orderId,
    email: record.email,
    name: record.name,
    total: record.total,
    items,
  };
}

function redisConnection(): ConnectionOptions {
  const url = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
  if (url.protocol !== "redis:" && url.protocol !== "rediss:") {
    throw new Error("REDIS_URL must use the redis:// or rediss:// protocol");
  }

  const database = url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0;
  if (!Number.isInteger(database) || database < 0) {
    throw new Error("REDIS_URL must contain a valid database number");
  }

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: database,
    tls: url.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
