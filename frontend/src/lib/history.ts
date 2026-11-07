export type HistoryEventType =
  "VIEW" | "SEARCH" | "CART_ADD" | "CART_REMOVE" | "PURCHASE";

interface HistoryEvent {
  type: HistoryEventType;
  productId?: string;
  query?: string;
  quantity?: number;
}

function getAccessToken(): string | null {
  try {
    const stored = localStorage.getItem("auth");
    if (!stored) return null;
    return JSON.parse(stored).accessToken ?? null;
  } catch {
    return null;
  }
}

export function recordEvent(event: HistoryEvent): void {
  const token = getAccessToken();

  void fetch("/api/history/event", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(event),
    keepalive: true,
  }).catch(() => {});
}
