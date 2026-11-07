import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

@Controller("orders")
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  async findByUser(@CurrentUser("id") userId: string) {
    return this.ordersService.findByUserId(userId);
  }

  @Get(":id")
  async findById(@Param("id") id: string, @CurrentUser("id") userId: string) {
    return this.ordersService.findByIdForUser(id, userId);
  }

  @Get(":id/payment-status")
  async findPaymentStatus(
    @Param("id") id: string,
    @CurrentUser("id") userId: string,
  ) {
    return this.ordersService.findPaymentStatus(id, userId);
  }
}
