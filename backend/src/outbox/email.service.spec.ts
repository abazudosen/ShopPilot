import { ConfigService } from "@nestjs/config";
import nodemailer from "nodemailer";
import { EmailService } from "./email.service";

jest.mock("nodemailer", () => ({
  __esModule: true,
  default: { createTransport: jest.fn() },
}));

describe("EmailService", () => {
  const createTransport = nodemailer.createTransport as jest.Mock;
  const sendMail = jest.fn();
  let service: EmailService;

  beforeEach(() => {
    jest.clearAllMocks();
    sendMail.mockResolvedValue({ messageId: "mail-1" });
    createTransport.mockReturnValue({ sendMail });
    const config = {
      get: (key: string, defaultValue?: string) =>
        ({
          SMTP_HOST: "mailpit",
          SMTP_PORT: "1025",
          EMAIL_FROM: "ShopPilot Demo <demo@example.test>",
        })[key] ?? defaultValue,
    };
    service = new EmailService(config as unknown as ConfigService);
  });

  it("sends a plain-text order confirmation through the configured SMTP relay", async () => {
    await service.sendOrderConfirmation({
      orderId: "order-12345678",
      email: "buyer@example.test",
      name: "Buyer",
      total: 25,
      items: [{ name: "Headphones", quantity: 2, price: 12.5 }],
    });

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: "mailpit", port: 1025 }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "buyer@example.test",
        subject: "ShopPilot order confirmed (order-12)",
        messageId: "<order-confirmation-order-12345678@shoppilot.local>",
        text: expect.stringContaining("- Headphones x 2: $25.00"),
      }),
    );
  });

  it("rejects malformed notification recipients", async () => {
    await expect(
      service.sendOrderConfirmation({
        orderId: "order-1",
        email: "not-an-email",
        name: "Buyer",
        total: 1,
        items: [],
      }),
    ).rejects.toThrow("invalid recipient");
    expect(createTransport).not.toHaveBeenCalled();
  });
});
