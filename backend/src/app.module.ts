import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { ProductsModule } from "./products/products.module";
import { OrdersModule } from "./orders/orders.module";
import { SearchModule } from "./search/search.module";
import { ChatModule } from "./chat/chat.module";
import { HistoryModule } from "./history/history.module";
import { TicketsModule } from "./tickets/tickets.module";
import { OutboxModule } from "./outbox/outbox.module";
import { KnowledgeModule } from "./knowledge/knowledge.module";
import { AiProviderModule } from "./ai/ai-provider.module";
import { IntegrationsModule } from "./integrations/integrations.module";
import { TelemetryInterceptor } from "./telemetry.interceptor";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { HealthController } from "./health.controller";
import { PaymentsModule } from "./payments/payments.module";
import * as path from "path";

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({
      envFilePath: path.resolve(__dirname, "../../.env"),
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    ProductsModule,
    OrdersModule,
    SearchModule,
    ChatModule,
    HistoryModule,
    TicketsModule,
    OutboxModule,
    KnowledgeModule,
    AiProviderModule,
    IntegrationsModule,
    PaymentsModule,
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: TelemetryInterceptor }],
})
export class AppModule {}
