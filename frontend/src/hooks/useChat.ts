import { useState, useCallback, useRef } from "react";
import type { ChatMessage } from "../types/chat";
import type { Product } from "../types/product";

interface CartLine {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

interface UseChatOptions {
  onCartAdd?: (product: Product) => void;
  onCartRemove?: (productId: string) => void;
  onCartUpdateQty?: (productId: string, quantity: number) => void;
  onNavigate?: (path: string) => void;
  getCart?: () => CartLine[];
}

function getAccessToken(): string | null {
  try {
    const stored = localStorage.getItem("auth");
    return stored ? (JSON.parse(stored).accessToken ?? null) : null;
  } catch {
    return null;
  }
}

export function useChat(options: UseChatOptions = {}) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hey there! Welcome to ShopPilot. I'm your shopping assistant. What are you looking for today?",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const sendMessage = useCallback(
    async (content: string) => {
      const userMsg: ChatMessage = { role: "user", content };
      setMessages((prev) => [
        ...prev,
        userMsg,
        { role: "assistant", content: "" },
      ]);
      setIsLoading(true);

      try {
        const history = messages
          .filter((_, i) => i > 0)
          .map((m) => ({ role: m.role, content: m.content }));

        const token = getAccessToken();
        const cart = optionsRef.current.getCart?.() ?? [];
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ message: content, history, cart }),
        });
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "text" && data.content) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content + data.content,
                  };
                  return updated;
                });
              } else if (data.type === "products" && data.products) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  updated[updated.length - 1] = {
                    ...last,
                    products: data.products as Product[],
                  };
                  return updated;
                });
              } else if (data.type === "citations" && data.citations) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  updated[updated.length - 1] = {
                    ...last,
                    citations: data.citations,
                  };
                  return updated;
                });
              } else if (
                data.type === "confirmation_required" &&
                data.confirmation
              ) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  updated[updated.length - 1] = {
                    ...last,
                    confirmation: data.confirmation,
                  };
                  return updated;
                });
              } else if (data.type === "cart_add" && data.product) {
                optionsRef.current.onCartAdd?.(data.product as Product);
              } else if (data.type === "cart_remove" && data.productId) {
                optionsRef.current.onCartRemove?.(data.productId as string);
              } else if (
                data.type === "cart_update_qty" &&
                data.productId &&
                data.quantity != null
              ) {
                optionsRef.current.onCartUpdateQty?.(
                  data.productId as string,
                  data.quantity as number,
                );
              } else if (data.type === "navigate" && data.path) {
                optionsRef.current.onNavigate?.(data.path as string);
              } else if (data.type === "action_result" && data.message) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content
                      ? `${last.content}\n\n${data.message}\n\n`
                      : `${data.message}\n\n`,
                  };
                  return updated;
                });
              } else if (data.type === "error") {
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: "Sorry, something went wrong. Please try again.",
                  };
                  return updated;
                });
              }
            } catch (error) {
              console.error("Could not parse a chat stream event", error);
            }
          }
        }
      } catch {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: "Sorry, I could not connect. Please try again.",
          };
          return updated;
        });
      }

      setIsLoading(false);
    },
    [messages],
  );

  const resolveAction = useCallback(
    async (actionId: string, confirm: boolean) => {
      setIsLoading(true);
      try {
        const token = getAccessToken();
        if (!token) throw new Error("Sign in to confirm this action.");
        const response = await fetch(
          `/api/chat/actions/${encodeURIComponent(actionId)}/${confirm ? "confirm" : "reject"}`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.message || "Could not process this action.");
        }
        setMessages((prev) => [
          ...prev.map((message) =>
            message.confirmation?.id === actionId
              ? { ...message, confirmation: undefined }
              : message,
          ),
          {
            role: "assistant",
            content: data?.message || "The action was not performed.",
          },
        ]);
      } catch (error: unknown) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              error instanceof Error
                ? error.message
                : "Could not process this action.",
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return { messages, sendMessage, resolveAction, isLoading };
}
