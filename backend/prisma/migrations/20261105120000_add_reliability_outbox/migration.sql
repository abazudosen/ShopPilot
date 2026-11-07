ALTER TABLE "orders"
ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "requestHash" TEXT;

CREATE UNIQUE INDEX "orders_userId_idempotencyKey_key"
ON "orders"("userId", "idempotencyKey");

ALTER TABLE "user_events"
ADD COLUMN "outboxEventId" TEXT;

CREATE UNIQUE INDEX "user_events_outboxEventId_key"
ON "user_events"("outboxEventId");

CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "outbox_events_status_createdAt_idx"
ON "outbox_events"("status", "createdAt");
