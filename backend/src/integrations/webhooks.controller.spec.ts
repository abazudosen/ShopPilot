import { createHmac } from "node:crypto";
import { verifySignature } from "./webhooks.controller";

describe("verifySignature", () => {
  const body = Buffer.from('{"id":"evt_1","type":"order.updated"}');
  const secret = "local-test-secret-at-least-16-chars";

  it("accepts a SHA-256 HMAC signature of the exact request body", () => {
    const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

    expect(verifySignature(body, signature, secret)).toBe(true);
  });

  it("rejects altered bodies and malformed signatures", () => {
    const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

    expect(verifySignature(Buffer.from(`${body} `), signature, secret)).toBe(
      false,
    );
    expect(verifySignature(body, "sha256=invalid", secret)).toBe(false);
  });
});
