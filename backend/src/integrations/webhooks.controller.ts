import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  PayloadTooLargeException,
  Post,
  Req,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { WebhooksService } from "./webhooks.service";

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

const MAX_WEBHOOK_BYTES = 100_000;

@Controller("integrations/webhooks")
export class WebhooksController {
  constructor(
    private readonly configService: ConfigService,
    private readonly webhooksService: WebhooksService,
  ) {}

  @Post(":provider")
  @HttpCode(202)
  async receive(
    @Req() request: RequestWithRawBody,
    @Headers("x-webhook-id") eventId?: string,
    @Headers("x-webhook-event") eventType?: string,
  ) {
    const providerParam: unknown = request.params.provider;
    if (
      typeof providerParam !== "string" ||
      !/^[a-z0-9][a-z0-9_-]{0,49}$/i.test(providerParam)
    ) {
      throw new BadRequestException("Invalid provider identifier");
    }
    const provider = providerParam;
    const rawBody = request.rawBody;
    if (!rawBody) {
      throw new BadRequestException("Raw request body is unavailable");
    }
    if (rawBody.length > MAX_WEBHOOK_BYTES) {
      throw new PayloadTooLargeException("Webhook payload exceeds 100 KB");
    }
    if (
      !eventId ||
      eventId.length > 255 ||
      !eventType ||
      eventType.length > 255
    ) {
      throw new BadRequestException("Valid webhook ID and event type required");
    }

    const signature = request.get("x-webhook-signature");
    const secret = this.getWebhookSecret(provider);
    if (!signature || !verifySignature(rawBody, signature, secret)) {
      throw new BadRequestException("Invalid webhook signature");
    }
    if (
      typeof request.body !== "object" ||
      request.body === null ||
      Array.isArray(request.body)
    ) {
      throw new BadRequestException("Webhook payload must be a JSON object");
    }

    return this.webhooksService.receive({
      provider,
      eventId,
      eventType,
      payload: request.body,
    });
  }

  private getWebhookSecret(provider: string): string {
    const configured = this.configService.get<string>("WEBHOOK_SECRETS");
    if (!configured) {
      throw new BadRequestException("Webhook provider is not configured");
    }
    let secrets: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(configured);
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        throw new Error("Expected a JSON object");
      }
      secrets = parsed as Record<string, unknown>;
    } catch {
      throw new Error("WEBHOOK_SECRETS must be a JSON object");
    }
    const secret = secrets[provider];
    if (typeof secret !== "string" || secret.length < 16) {
      throw new BadRequestException("Webhook provider is not configured");
    }
    return secret;
  }
}

export function verifySignature(
  body: Buffer,
  signature: string,
  secret: string,
): boolean {
  const match = /^sha256=([a-f0-9]{64})$/i.exec(signature);
  if (!match) return false;
  const expected = createHmac("sha256", secret).update(body).digest();
  const provided = Buffer.from(match[1], "hex");
  return timingSafeEqual(expected, provided);
}
