import type { Product } from "./product";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  products?: Product[];
  citations?: Array<{
    id: string;
    title: string;
    sourceUrl: string;
    category: string;
  }>;
  confirmation?: {
    id: string;
    actionType: string;
    summary: string;
    expiresAt: string;
  };
}
