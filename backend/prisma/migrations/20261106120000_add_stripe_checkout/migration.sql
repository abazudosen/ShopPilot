ALTER TABLE "orders"
ADD COLUMN "stripeCheckoutSessionId" TEXT,
ADD COLUMN "stripePaymentIntentId" TEXT,
ADD COLUMN "checkoutAttempt" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "orders_stripeCheckoutSessionId_key"
ON "orders"("stripeCheckoutSessionId");
