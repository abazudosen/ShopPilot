ALTER TABLE "ai_usage"
ADD COLUMN "reservationExpiresAt" TIMESTAMP(3);

CREATE INDEX "ai_usage_status_reservationExpiresAt_createdAt_idx"
ON "ai_usage"("status", "reservationExpiresAt", "createdAt");
