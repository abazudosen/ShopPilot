export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatStreamEvent {
  type:
    | "text"
    | "products"
    | "cart_add"
    | "cart_remove"
    | "cart_update_qty"
    | "navigate"
    | "action_result"
    | "citations"
    | "confirmation_required";
  content?: string;
  productIds?: string[];
  productId?: string;
  quantity?: number;
  path?: string;
  message?: string;
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
