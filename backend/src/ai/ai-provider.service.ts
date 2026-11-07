import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { metrics, trace } from "@opentelemetry/api";
import { Prisma } from "../prisma/client";
import OpenAI from "openai";
import { PrismaService } from "../prisma/prisma.service";

const meter = metrics.getMeter("shopping-ai");
const requestCounter = meter.createCounter("ai.requests");
const latencyHistogram = meter.createHistogram("ai.request.duration", {
  unit: "ms",
});
const tokenCounter = meter.createCounter("ai.tokens");
const costCounter = meter.createCounter("ai.estimated_cost_usd");
const tracer = trace.getTracer("shopping-ai");
const BUDGET_LOCK_ID = 8_431_927;

export class AiBudgetExceededError extends Error {
  constructor() {
    super("Configured daily AI budget would be exceeded");
    this.name = "AiBudgetExceededError";
  }
}

@Injectable()
export class AiProviderService {
  private readonly logger = new Logger(AiProviderService.name);
  private readonly client?: OpenAI;
  readonly chatModel: string;
  readonly fallbackChatModel?: string;
  readonly embeddingModel: string;
  readonly provider: string;
  private readonly requestTimeoutMs: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const apiKey =
      this.configService.get<string>("AI_API_KEY")?.trim() ||
      this.configService.get<string>("OPENAI_API_KEY")?.trim();
    const baseURL = this.configService.get<string>("AI_API_BASE_URL")?.trim();
    if (baseURL) {
      const url = new URL(baseURL);
      if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("AI_API_BASE_URL must use HTTP or HTTPS");
      }
    }
    this.chatModel = this.configService.get<string>(
      "OPENAI_CHAT_MODEL",
      "gpt-4o-mini",
    );
    this.fallbackChatModel =
      this.configService.get<string>("OPENAI_FALLBACK_CHAT_MODEL")?.trim() ||
      undefined;
    this.provider = this.configService.get<string>("AI_PROVIDER", "openai");
    const requestTimeoutMs = Number(
      this.configService.get<string | number>("AI_REQUEST_TIMEOUT_MS", 20_000),
    );
    if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1) {
      throw new Error("AI_REQUEST_TIMEOUT_MS must be a positive integer");
    }
    this.requestTimeoutMs = requestTimeoutMs;
    if (apiKey && apiKey !== "sk-your-key-here") {
      this.client = new OpenAI({
        apiKey,
        ...(baseURL ? { baseURL } : {}),
        timeout: this.requestTimeoutMs,
        maxRetries: 0,
      });
    }
    this.embeddingModel = this.configService.get<string>(
      "OPENAI_EMBEDDING_MODEL",
      "text-embedding-3-small",
    );
    this.inputRate = parseRate(
      this.configService.get<string>("AI_COST_INPUT_USD_PER_MILLION"),
    );
    this.outputRate = parseRate(
      this.configService.get<string>("AI_COST_OUTPUT_USD_PER_MILLION"),
    );
    const budget = parseRate(
      this.configService.get<string>("AI_DAILY_BUDGET_USD"),
    );
    if (budget > 0 && this.inputRate === 0 && this.outputRate === 0) {
      throw new Error(
        "AI cost rates must be configured when AI_DAILY_BUDGET_USD is set",
      );
    }
    this.dailyBudget = budget;
  }

  private readonly inputRate: number;
  private readonly outputRate: number;
  private readonly dailyBudget: number;

  private async reserveBudget(input: {
    userId?: string;
    model: string;
    inputTokens: number;
    maxOutputTokens: number;
  }): Promise<string | undefined> {
    if (this.dailyBudget <= 0) return undefined;
    const now = new Date();
    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);
    const reservationCost =
      Math.ceil(
        this.estimateCost(input.inputTokens, input.maxOutputTokens) * 1e8,
      ) / 1e8;

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${BUDGET_LOCK_ID})`;
      const usage = await tx.aIUsage.aggregate({
        where: {
          createdAt: { gte: today },
          OR: [
            { status: "SUCCEEDED" },
            { status: "FAILED" },
            {
              status: "RESERVED",
              reservationExpiresAt: { gt: now },
            },
          ],
        },
        _sum: { estimatedCost: true },
      });
      const currentCost = Number(usage._sum.estimatedCost ?? 0);
      if (currentCost + reservationCost > this.dailyBudget) {
        throw new AiBudgetExceededError();
      }

      const reservation = await tx.aIUsage.create({
        data: {
          userId: input.userId,
          provider: this.provider,
          model: input.model,
          inputTokens: input.inputTokens,
          outputTokens: input.maxOutputTokens,
          estimatedCost: new Prisma.Decimal(reservationCost.toFixed(8)),
          latencyMs: 0,
          status: "RESERVED",
          tokenEstimate: true,
          costConfigured: true,
          reservationExpiresAt: new Date(
            now.getTime() + this.requestTimeoutMs * 2,
          ),
        },
        select: { id: true },
      });
      return reservation.id;
    });
  }

  isConfigured(): boolean {
    return this.client !== undefined;
  }

  async *streamChat(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    tools: OpenAI.Chat.Completions.ChatCompletionTool[],
    userId?: string,
  ): AsyncGenerator<OpenAI.Chat.Completions.ChatCompletionChunk> {
    if (!this.client) throw new Error("AI provider is not configured");
    const models = [
      this.chatModel,
      ...(this.fallbackChatModel && this.fallbackChatModel !== this.chatModel
        ? [this.fallbackChatModel]
        : []),
    ];

    for (const [modelIndex, model] of models.entries()) {
      const estimatedInputTokens = Math.ceil(
        JSON.stringify(messages).length / 4,
      );
      const reservationId = await this.reserveBudget({
        userId,
        model,
        inputTokens: estimatedInputTokens,
        maxOutputTokens: 1_200,
      });
      const startedAt = Date.now();
      const span = tracer.startSpan("ai.chat.completion");
      span.setAttribute("ai.provider", this.provider);
      span.setAttribute("ai.model", model);
      let inputTokens = 0;
      let outputTokens = 0;
      let inputEstimated = true;
      let sawChunk = false;

      try {
        const stream = await this.client.chat.completions.create({
          model,
          stream: true,
          stream_options: { include_usage: true },
          max_completion_tokens: 1_200,
          temperature: 0.2,
          tools,
          parallel_tool_calls: false,
          messages,
        });

        for await (const chunk of stream) {
          sawChunk = true;
          if (chunk.usage) {
            inputTokens = chunk.usage.prompt_tokens;
            outputTokens = chunk.usage.completion_tokens;
            inputEstimated = false;
          } else {
            outputTokens += chunk.choices.reduce(
              (sum, choice) =>
                sum + Math.ceil((choice.delta?.content?.length ?? 0) / 4),
              0,
            );
          }
          yield chunk;
        }

        if (inputEstimated) {
          inputTokens = Math.ceil(JSON.stringify(messages).length / 4);
        }
        await this.recordUsage({
          reservationId,
          userId,
          model,
          inputTokens,
          outputTokens,
          inputEstimated,
          latencyMs: Date.now() - startedAt,
          status: "SUCCEEDED",
        });
        return;
      } catch (error) {
        span.recordException(error as Error);
        const latencyMs = Date.now() - startedAt;
        const canFallback = modelIndex + 1 < models.length && !sawChunk;
        await this.recordUsage({
          reservationId,
          userId,
          model,
          inputTokens: Math.ceil(JSON.stringify(messages).length / 4),
          outputTokens,
          inputEstimated: true,
          latencyMs,
          status: "FAILED",
        });
        if (canFallback) {
          this.logger.warn(
            `AI model ${model} failed before streaming; trying configured fallback`,
          );
          continue;
        }
        throw error;
      } finally {
        span.end();
      }
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const [embedding] = await this.generateEmbeddings([text]);
    return embedding;
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.client) throw new Error("AI provider is not configured");
    if (texts.length === 0) return [];
    const estimatedInputTokens = Math.ceil(texts.join("\n").length / 4);
    const reservationId = await this.reserveBudget({
      model: this.embeddingModel,
      inputTokens: estimatedInputTokens,
      maxOutputTokens: 0,
    });

    const startedAt = Date.now();
    try {
      const response = await this.client.embeddings.create({
        model: this.embeddingModel,
        input: texts,
      });
      const vectors = response.data
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding);
      const tokens = response.usage.prompt_tokens;
      await this.recordUsage({
        reservationId,
        model: this.embeddingModel,
        inputTokens: tokens,
        outputTokens: 0,
        inputEstimated: false,
        latencyMs: Date.now() - startedAt,
        status: "SUCCEEDED",
      });
      return vectors;
    } catch (error) {
      await this.recordUsage({
        reservationId,
        model: this.embeddingModel,
        inputTokens: estimatedInputTokens,
        outputTokens: 0,
        inputEstimated: true,
        latencyMs: Date.now() - startedAt,
        status: "FAILED",
      });
      throw error;
    }
  }

  private async recordUsage(input: {
    reservationId?: string;
    userId?: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    inputEstimated: boolean;
    latencyMs: number;
    status: string;
  }): Promise<void> {
    const cost =
      (input.inputTokens * this.inputRate +
        input.outputTokens * this.outputRate) /
      1_000_000;

    requestCounter.add(1, {
      provider: this.provider,
      model: input.model,
      status: input.status,
    });
    latencyHistogram.record(input.latencyMs, {
      provider: this.provider,
      model: input.model,
    });
    tokenCounter.add(input.inputTokens, {
      provider: this.provider,
      model: input.model,
      direction: "input",
      estimated: String(input.inputEstimated),
    });
    tokenCounter.add(input.outputTokens, {
      provider: this.provider,
      model: input.model,
      direction: "output",
      estimated: String(input.inputEstimated),
    });
    costCounter.add(cost, { provider: this.provider, model: input.model });

    try {
      const data = {
        userId: input.userId,
        provider: this.provider,
        model: input.model,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        estimatedCost: new Prisma.Decimal(cost.toFixed(8)),
        latencyMs: input.latencyMs,
        status: input.status,
        tokenEstimate: input.inputEstimated,
        costConfigured: this.inputRate > 0 || this.outputRate > 0,
        reservationExpiresAt: null,
      };
      if (input.reservationId) {
        await this.prisma.aIUsage.update({
          where: { id: input.reservationId },
          data,
        });
      } else {
        await this.prisma.aIUsage.create({ data });
      }
    } catch (error) {
      this.logger.error(
        `Could not persist AI usage: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private estimateCost(inputTokens: number, outputTokens: number): number {
    return (
      (inputTokens * this.inputRate + outputTokens * this.outputRate) /
      1_000_000
    );
  }
}

function parseRate(value: string | undefined): number {
  if (!value) return 0;
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate < 0) {
    throw new Error("AI cost rates must be finite non-negative numbers");
  }
  return rate;
}
