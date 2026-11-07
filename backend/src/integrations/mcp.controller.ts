import {
  All,
  Controller,
  Logger,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { createHash, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { ProductsService } from "../products/products.service";
import { KnowledgeService } from "../knowledge/knowledge.service";
import { PrismaService } from "../prisma/prisma.service";

@Controller()
export class McpController {
  private readonly logger = new Logger(McpController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly productsService: ProductsService,
    private readonly knowledgeService: KnowledgeService,
    private readonly prisma: PrismaService,
  ) {}

  @All("mcp")
  async handle(@Req() request: Request, @Res() response: Response) {
    const expectedToken = this.configService
      .get<string>("MCP_API_TOKEN")
      ?.trim();
    const providedToken = request
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "");
    if (!expectedToken) {
      throw new ServiceUnavailableException("MCP is not configured");
    }
    if (!providedToken || !constantTimeEqual(providedToken, expectedToken)) {
      throw new UnauthorizedException("Invalid MCP bearer token");
    }

    const server = new McpServer(
      { name: "shoppilot-store", version: "1.0.0" },
      { maxToolInputElements: 20 },
    );
    this.registerReadOnlyTools(server);

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(request, response, request.body);
    } catch (error) {
      this.logger.error(
        `MCP request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (!response.headersSent) {
        response.status(500).json({ error: "MCP request failed" });
      } else {
        response.end();
      }
    } finally {
      await server.close();
    }
  }

  private registerReadOnlyTools(server: McpServer): void {
    server.registerTool(
      "search_products",
      {
        description: "Search the public product catalog. Read-only.",
        inputSchema: { query: z.string().trim().min(1).max(300) },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      async ({ query }) => {
        const products = await this.productsService.searchByRelevance(query);
        await this.auditMcpTool("search_products", {
          resultCount: products.length,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                products.slice(0, 8).map((product) => ({
                  id: product.id,
                  name: product.name,
                  price: product.price,
                  category: product.category,
                  inStock: product.inStock,
                })),
              ),
            },
          ],
        };
      },
    );

    server.registerTool(
      "get_product",
      {
        description: "Get public details for one product. Read-only.",
        inputSchema: { productId: z.string().trim().min(1).max(100) },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      async ({ productId }) => {
        const product = await this.productsService.findById(productId);
        await this.auditMcpTool("get_product", {
          found: Boolean(product),
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                product
                  ? {
                      id: product.id,
                      name: product.name,
                      description: product.description,
                      price: product.price,
                      category: product.category,
                      features: product.features,
                      inStock: product.inStock,
                    }
                  : { error: "Product not found" },
              ),
            },
          ],
        };
      },
    );

    server.registerTool(
      "search_store_documents",
      {
        description:
          "Search shared public FAQs, manuals, and policies. Read-only.",
        inputSchema: { query: z.string().trim().min(1).max(300) },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      async ({ query }) => {
        const result = await this.knowledgeService.search(query);
        await this.auditMcpTool("search_store_documents", {
          citationCount: result.citations.length,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                citations: result.citations,
                context: result.context,
              }),
            },
          ],
        };
      },
    );
  }

  private async auditMcpTool(
    toolName: string,
    details: Record<string, number | boolean>,
  ): Promise<void> {
    try {
      await this.prisma.agentToolAudit.create({
        data: {
          toolName: `mcp:${toolName}`,
          status: "SUCCEEDED",
          details,
        },
      });
    } catch (error) {
      this.logger.error(
        `Could not persist MCP audit for ${toolName}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

function constantTimeEqual(candidate: string, expected: string): boolean {
  return timingSafeEqual(
    createHash("sha256").update(candidate).digest(),
    createHash("sha256").update(expected).digest(),
  );
}
