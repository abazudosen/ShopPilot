import { Controller, Post, Body, Res, UseGuards, Param } from "@nestjs/common";
import type { Response } from "express";
import { ChatService } from "./chat.service";
import { ChatMessageDto } from "./dto/chat-message.dto";
import { ProductsService } from "../products/products.service";
import { OptionalJwtAuthGuard } from "../auth/guards/optional-jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@Controller("chat")
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly productsService: ProductsService,
  ) {}

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  async chat(
    @Body() dto: ChatMessageDto,
    @Res() res: Response,
    @CurrentUser() user?: { id: string; role: "BUYER" | "SELLER" },
  ) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      for await (const event of this.chatService.streamChat(
        dto.message,
        dto.history,
        user?.id,
        dto.cart,
        user?.role,
      )) {
        if (event.type === "text") {
          res.write(
            `data: ${JSON.stringify({ type: "text", content: event.content })}\n\n`,
          );
        } else if (event.type === "products") {
          const products = await this.productsService.findByIds(
            event.productIds!,
          );
          res.write(
            `data: ${JSON.stringify({ type: "products", products })}\n\n`,
          );
        } else if (event.type === "cart_add") {
          const product = await this.productsService.findById(event.productId!);
          if (product) {
            res.write(
              `data: ${JSON.stringify({ type: "cart_add", product })}\n\n`,
            );
          }
        } else if (event.type === "cart_remove") {
          res.write(
            `data: ${JSON.stringify({ type: "cart_remove", productId: event.productId })}\n\n`,
          );
        } else if (event.type === "cart_update_qty") {
          res.write(
            `data: ${JSON.stringify({ type: "cart_update_qty", productId: event.productId, quantity: event.quantity })}\n\n`,
          );
        } else if (event.type === "navigate") {
          res.write(
            `data: ${JSON.stringify({ type: "navigate", path: event.path })}\n\n`,
          );
        } else if (event.type === "action_result") {
          res.write(
            `data: ${JSON.stringify({ type: "action_result", message: event.message })}\n\n`,
          );
        } else if (event.type === "citations") {
          res.write(
            `data: ${JSON.stringify({ type: "citations", citations: event.citations })}\n\n`,
          );
        } else if (event.type === "confirmation_required") {
          res.write(
            `data: ${JSON.stringify({ type: "confirmation_required", confirmation: event.confirmation })}\n\n`,
          );
        }
      }
      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    } catch (error) {
      res.write(
        `data: ${JSON.stringify({ type: "error", error: "Failed to generate response" })}\n\n`,
      );
    }
    res.end();
  }

  @Post("actions/:id/confirm")
  @UseGuards(JwtAuthGuard)
  confirmAction(
    @Param("id") actionId: string,
    @CurrentUser("id") userId: string,
  ) {
    return this.chatService.confirmAction(actionId, userId);
  }

  @Post("actions/:id/reject")
  @UseGuards(JwtAuthGuard)
  rejectAction(
    @Param("id") actionId: string,
    @CurrentUser("id") userId: string,
  ) {
    return this.chatService.rejectAction(actionId, userId);
  }
}
