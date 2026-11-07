CREATE TYPE "EventType" AS ENUM ('VIEW', 'SEARCH', 'CART_ADD', 'CART_REMOVE', 'PURCHASE');

CREATE TABLE "user_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "productId" TEXT,
    "query" TEXT,
    "quantity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_events_userId_createdAt_idx" ON "user_events"("userId", "createdAt");

ALTER TABLE "user_events" ADD CONSTRAINT "user_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_events" ADD CONSTRAINT "user_events_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
