import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { PrismaService } from "../prisma/prisma.service";
import {
  AiBudgetExceededError,
  AiProviderService,
} from "./ai-provider.service";

type UsageRow = Record<string, unknown> & {
  id: string;
  createdAt: Date;
  status: string;
  estimatedCost: number;
  reservationExpiresAt: Date | null;
};

function createHarness(
  overrides: Record<string, string | number> = {},
  existingUsage: UsageRow[] = [],
) {
  const rows = existingUsage;
  let nextId = 0;
  let lockTail = Promise.resolve();
  const prismaMock = {
    $transaction: jest.fn(
      async (callback: (tx: unknown) => Promise<unknown>) => {
        let unlock: (() => void) | undefined;
        const tx = {
          $queryRaw: async () => {
            const previous = lockTail;
            lockTail = new Promise<void>((resolve) => {
              unlock = resolve;
            });
            await previous;
          },
          aIUsage: {
            aggregate: jest.fn(
              async ({ where }: { where: { createdAt: { gte: Date } } }) => {
                const now = new Date();
                const total = rows
                  .filter(
                    (row) =>
                      row.createdAt >= where.createdAt.gte &&
                      (row.status !== "RESERVED" ||
                        (row.reservationExpiresAt !== null &&
                          row.reservationExpiresAt > now)),
                  )
                  .reduce((sum, row) => sum + row.estimatedCost, 0);
                return { _sum: { estimatedCost: total } };
              },
            ),
            create: jest.fn(
              async ({ data }: { data: Record<string, unknown> }) => {
                const row = {
                  ...data,
                  id: `usage-${++nextId}`,
                  createdAt: new Date(),
                  estimatedCost: Number(data.estimatedCost),
                  reservationExpiresAt:
                    data.reservationExpiresAt instanceof Date
                      ? data.reservationExpiresAt
                      : null,
                } as UsageRow;
                rows.push(row);
                return { id: row.id };
              },
            ),
            update: jest.fn(
              async ({
                where,
                data,
              }: {
                where: { id: string };
                data: Record<string, unknown>;
              }) => {
                const row = rows.find((entry) => entry.id === where.id);
                if (!row) throw new Error("Usage reservation not found");
                Object.assign(row, data, {
                  estimatedCost: Number(data.estimatedCost),
                  reservationExpiresAt: null,
                });
                return row;
              },
            ),
          },
        };
        try {
          return await callback(tx);
        } finally {
          unlock?.();
        }
      },
    ),
    aIUsage: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        rows.push({
          ...data,
          id: `usage-${++nextId}`,
          createdAt: new Date(),
          estimatedCost: Number(data.estimatedCost),
          status: String(data.status),
          reservationExpiresAt: null,
        } as UsageRow);
      }),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const row = rows.find((entry) => entry.id === where.id);
          if (!row) throw new Error("Usage reservation not found");
          Object.assign(row, data, {
            estimatedCost: Number(data.estimatedCost),
            reservationExpiresAt: null,
          });
          return row;
        },
      ),
    },
  };
  const configValues: Record<string, string | number> = {
    AI_API_KEY: "test-key",
    OPENAI_CHAT_MODEL: "primary-model",
    AI_COST_INPUT_USD_PER_MILLION: 1,
    AI_COST_OUTPUT_USD_PER_MILLION: 1,
    AI_DAILY_BUDGET_USD: 0.002,
    AI_REQUEST_TIMEOUT_MS: 10_000,
    ...overrides,
  };
  const config = {
    get: (key: string, defaultValue?: unknown) =>
      configValues[key] ?? defaultValue,
  };
  const service = new AiProviderService(
    config as unknown as ConfigService,
    prismaMock as unknown as PrismaService,
  );
  return { service, prismaMock, rows };
}

function streamWithUsage(promptTokens = 10, completionTokens = 5) {
  return (async function* () {
    yield { choices: [{ delta: { content: "answer" } }] };
    yield {
      choices: [],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
      },
    };
  })();
}

async function consumeChat(service: AiProviderService) {
  const chunks = [];
  for await (const chunk of service.streamChat(
    [{ role: "user", content: "a short question" }],
    [],
    "user-1",
  )) {
    chunks.push(chunk);
  }
  return chunks;
}

function createClient(chatCreate: jest.Mock, embeddingsCreate = jest.fn()) {
  return {
    chat: { completions: { create: chatCreate } },
    embeddings: { create: embeddingsCreate },
  };
}

describe("AiProviderService budget and provider behavior", () => {
  it("reserves estimated cost atomically before concurrent model calls", async () => {
    const { service, rows, prismaMock } = createHarness();
    let startRequest!: () => void;
    const requestStarted = new Promise<void>((resolve) => {
      startRequest = resolve;
    });
    let finishRequest!: (stream: AsyncGenerator<unknown>) => void;
    const pendingStream = new Promise<AsyncGenerator<unknown>>((resolve) => {
      finishRequest = resolve;
    });
    const chatCreate = jest.fn(() => {
      startRequest();
      return pendingStream;
    });
    Object.defineProperty(service, "client", {
      value: createClient(chatCreate),
    });

    const first = consumeChat(service);
    await requestStarted;
    await expect(consumeChat(service)).rejects.toBeInstanceOf(
      AiBudgetExceededError,
    );
    expect(chatCreate).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("RESERVED");
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);

    finishRequest(streamWithUsage() as AsyncGenerator<unknown>);
    await expect(first).resolves.toHaveLength(2);
    expect(rows[0].status).toBe("SUCCEEDED");
    expect(rows[0].estimatedCost).toBeCloseTo(0.000015);
    expect(rows[0].reservationExpiresAt).toBeNull();
  });

  it("uses the configured fallback only when the primary fails before streaming", async () => {
    const { service, rows } = createHarness({
      OPENAI_FALLBACK_CHAT_MODEL: "fallback-model",
    });
    const chatCreate = jest
      .fn()
      .mockRejectedValueOnce(new Error("primary unavailable"))
      .mockResolvedValueOnce(streamWithUsage());
    Object.defineProperty(service, "client", {
      value: createClient(chatCreate),
    });

    await expect(consumeChat(service)).resolves.toHaveLength(2);
    expect(chatCreate.mock.calls.map(([params]) => params.model)).toEqual([
      "primary-model",
      "fallback-model",
    ]);
    expect(rows.map((row) => row.status)).toEqual(["FAILED", "SUCCEEDED"]);
    expect(rows.every((row) => row.reservationExpiresAt === null)).toBe(true);
  });

  it("does not fall back after the primary has emitted output", async () => {
    const { service, rows } = createHarness({
      OPENAI_FALLBACK_CHAT_MODEL: "fallback-model",
    });
    const partialThenFail = (async function* () {
      yield { choices: [{ delta: { content: "partial" } }] };
      throw new Error("stream ended unexpectedly");
    })();
    const chatCreate = jest.fn().mockResolvedValue(partialThenFail);
    Object.defineProperty(service, "client", {
      value: createClient(chatCreate),
    });

    await expect(consumeChat(service)).rejects.toThrow(
      "stream ended unexpectedly",
    );
    expect(chatCreate).toHaveBeenCalledTimes(1);
    expect(rows.map((row) => row.status)).toEqual(["FAILED"]);
  });

  it("records actual embedding usage against its reservation", async () => {
    const { service, rows } = createHarness();
    const embeddingsCreate = jest.fn().mockResolvedValue({
      data: [
        { index: 0, embedding: [0.1, 0.2] },
        { index: 1, embedding: [0.3, 0.4] },
      ],
      usage: { prompt_tokens: 8 },
    });
    Object.defineProperty(service, "client", {
      value: createClient(jest.fn(), embeddingsCreate),
    });

    await expect(
      service.generateEmbeddings(["first", "second"]),
    ).resolves.toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      model: "text-embedding-3-small",
      inputTokens: 8,
      outputTokens: 0,
      status: "SUCCEEDED",
      estimatedCost: 0.000008,
      reservationExpiresAt: null,
    });
  });

  it("ignores expired reservations when checking today's budget", async () => {
    const { service, rows } = createHarness({}, [
      {
        id: "expired",
        createdAt: new Date(),
        status: "RESERVED",
        estimatedCost: 100,
        reservationExpiresAt: new Date(Date.now() - 1_000),
      },
    ]);
    const chatCreate = jest.fn().mockResolvedValue(streamWithUsage());
    Object.defineProperty(service, "client", {
      value: createClient(chatCreate),
    });

    await expect(consumeChat(service)).resolves.toHaveLength(2);
    expect(chatCreate).toHaveBeenCalledTimes(1);
    expect(rows[1].status).toBe("SUCCEEDED");
  });
});
