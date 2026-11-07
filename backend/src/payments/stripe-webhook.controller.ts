import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
} from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { PaymentsService } from "./payments.service";

@Controller("payments/stripe")
export class StripeWebhookController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post("webhook")
  @HttpCode(200)
  receive(
    @Req() request: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature?: string,
  ) {
    if (!request.rawBody || !signature) {
      throw new BadRequestException(
        "Stripe signature and raw body are required",
      );
    }
    const event = this.paymentsService.verifyWebhook(
      request.rawBody,
      signature,
    );
    return this.paymentsService.processStripeEvent(event);
  }
}
