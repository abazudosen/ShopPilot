import {
  Body,
  Controller,
  Headers,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CreateOrderDto } from "../orders/dto/create-order.dto";
import { PaymentsService } from "./payments.service";

@Controller("orders")
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post("checkout")
  createCheckout(
    @Body() dto: CreateOrderDto,
    @CurrentUser("id") userId: string,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    return this.paymentsService.createCheckout(dto, userId, idempotencyKey);
  }

  @Patch(":id/cancel")
  cancelOrder(@Param("id") orderId: string, @CurrentUser("id") userId: string) {
    return this.paymentsService.cancelOrder(orderId, userId);
  }
}
