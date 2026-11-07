import { Module } from "@nestjs/common";
import { ProductsModule } from "../products/products.module";
import { KnowledgeModule } from "../knowledge/knowledge.module";
import { McpController } from "./mcp.controller";
import { WebhooksController } from "./webhooks.controller";
import { WebhooksService } from "./webhooks.service";

@Module({
  imports: [ProductsModule, KnowledgeModule],
  controllers: [McpController, WebhooksController],
  providers: [WebhooksService],
})
export class IntegrationsModule {}
