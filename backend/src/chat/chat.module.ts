import { Module } from "@nestjs/common";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";
import { ProductsModule } from "../products/products.module";
import { HistoryModule } from "../history/history.module";
import { OrdersModule } from "../orders/orders.module";
import { TicketsModule } from "../tickets/tickets.module";
import { KnowledgeModule } from "../knowledge/knowledge.module";
import { AiProviderModule } from "../ai/ai-provider.module";
import { PaymentsModule } from "../payments/payments.module";

@Module({
  imports: [
    ProductsModule,
    HistoryModule,
    OrdersModule,
    TicketsModule,
    KnowledgeModule,
    AiProviderModule,
    PaymentsModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
