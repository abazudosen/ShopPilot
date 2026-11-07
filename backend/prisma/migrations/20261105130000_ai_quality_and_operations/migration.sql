CREATE TABLE "knowledge_documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "knowledge_chunks" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_actions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ai_actions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_tool_audits" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "actionId" TEXT,
    "toolName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_tool_audits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_usage" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "estimatedCost" DECIMAL(12,8) NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "tokenEstimate" BOOLEAN NOT NULL DEFAULT false,
    "costConfigured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "webhook_receipts" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "deliveryAttempts" INTEGER NOT NULL DEFAULT 1,
    "lastError" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "webhook_receipts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "knowledge_chunks_documentId_ordinal_key"
ON "knowledge_chunks"("documentId", "ordinal");
CREATE INDEX "knowledge_documents_ownerUserId_category_idx"
ON "knowledge_documents"("ownerUserId", "category");
CREATE INDEX "knowledge_chunks_documentId_idx" ON "knowledge_chunks"("documentId");
CREATE INDEX "ai_actions_userId_status_expiresAt_idx"
ON "ai_actions"("userId", "status", "expiresAt");
CREATE INDEX "agent_tool_audits_userId_createdAt_idx"
ON "agent_tool_audits"("userId", "createdAt");
CREATE INDEX "agent_tool_audits_actionId_createdAt_idx"
ON "agent_tool_audits"("actionId", "createdAt");
CREATE INDEX "ai_usage_createdAt_provider_model_idx"
ON "ai_usage"("createdAt", "provider", "model");
CREATE UNIQUE INDEX "webhook_receipts_provider_eventId_key"
ON "webhook_receipts"("provider", "eventId");
CREATE INDEX "webhook_receipts_provider_status_receivedAt_idx"
ON "webhook_receipts"("provider", "status", "receivedAt");

ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_ownerUserId_fkey"
FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_actions" ADD CONSTRAINT "ai_actions_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_tool_audits" ADD CONSTRAINT "agent_tool_audits_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agent_tool_audits" ADD CONSTRAINT "agent_tool_audits_actionId_fkey"
FOREIGN KEY ("actionId") REFERENCES "ai_actions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
