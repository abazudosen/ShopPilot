import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer, { type Transporter } from "nodemailer";

export interface OrderConfirmationEmail {
  orderId: string;
  email: string;
  name: string;
  total: number;
  items: Array<{ name: string; quantity: number; price: number }>;
}

@Injectable()
export class EmailService {
  private transporter?: Transporter;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.from = this.config.get<string>(
      "EMAIL_FROM",
      "ShopPilot Demo <no-reply@shoppilot.local>",
    );
  }

  async sendOrderConfirmation(input: OrderConfirmationEmail): Promise<void> {
    if (!input.email || !input.email.includes("@") || !input.orderId) {
      throw new Error(
        "Order confirmation email has invalid recipient or order",
      );
    }

    const itemLines = input.items
      .map(
        (item) =>
          `- ${item.name} x ${item.quantity}: $${(item.price * item.quantity).toFixed(2)}`,
      )
      .join("\n");
    await this.getTransporter().sendMail({
      from: this.from,
      to: input.email,
      subject: `ShopPilot order confirmed (${input.orderId.slice(0, 8)})`,
      messageId: `<order-confirmation-${input.orderId}@shoppilot.local>`,
      text: [
        `Hello ${input.name || "there"},`,
        "",
        "Your demo payment was received and your order is confirmed.",
        `Order: ${input.orderId}`,
        "",
        "Items:",
        itemLines,
        "",
        `Total: $${input.total.toFixed(2)}`,
        "",
        "This is an automated demo notification.",
      ].join("\n"),
    });
  }

  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;
    const host = this.config.get<string>("SMTP_HOST", "localhost");
    const port = Number(this.config.get<string>("SMTP_PORT", "1025"));
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      throw new Error("SMTP_PORT must be a valid TCP port");
    }
    const user = this.config.get<string>("SMTP_USER");
    const pass = this.config.get<string>("SMTP_PASSWORD");
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: this.config.get<string>("SMTP_SECURE", "false") === "true",
      ...(user && pass ? { auth: { user, pass } } : {}),
      connectionTimeout: 5_000,
      greetingTimeout: 5_000,
      socketTimeout: 10_000,
    });
    return this.transporter;
  }
}
