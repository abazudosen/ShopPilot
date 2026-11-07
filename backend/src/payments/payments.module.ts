import { Module } from "@nestjs/common";
import { OrdersModule } from "../orders/orders.module";
import { PrismaModule } from "../prisma/prisma.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { StripeWebhookController } from "./stripe-webhook.controller";

@Module({
  imports: [OrdersModule, PrismaModule],
  controllers: [PaymentsController, StripeWebhookController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
