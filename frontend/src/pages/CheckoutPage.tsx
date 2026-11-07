import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../hooks/useCart";
import { useAuth } from "../hooks/useAuth";

type StoredCheckoutKey = { payload: string; key: string };

function getCheckoutKey(payload: string) {
  const storageKey = "shoppilot-checkout-idempotency";
  try {
    const stored = sessionStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored) as StoredCheckoutKey;
      if (parsed.payload === payload && parsed.key) return parsed.key;
    }
  } catch {
    sessionStorage.removeItem(storageKey);
  }
  return crypto.randomUUID();
}

export default function CheckoutPage() {
  const { items, totalPrice, totalItems } = useCart();
  const { authFetch } = useAuth();
  const orderItems = items.map((item) => ({
    productId: item.product.id,
    quantity: item.quantity,
  }));
  const payload = JSON.stringify({ items: orderItems });
  const [idempotencyKey] = useState(() => getCheckoutKey(payload));
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setPlacing(true);

    try {
      sessionStorage.setItem(
        "shoppilot-checkout-idempotency",
        JSON.stringify({ payload, key: idempotencyKey }),
      );
      const res = await authFetch("/api/orders/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: payload,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Unable to start checkout");
      }

      const checkout = (await res.json()) as { checkoutUrl: string };
      window.location.assign(checkout.checkoutUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPlacing(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="max-w-[1280px] mx-auto px-6 py-20 text-center">
        <h2 className="text-2xl font-bold text-gray-900">Your cart is empty</h2>
        <p className="text-gray-500 mt-2">
          Add some products before checking out.
        </p>
        <Link
          to="/"
          className="inline-block mt-8 rounded-xl bg-emerald-800 px-8 py-3 font-semibold text-white transition-colors hover:bg-emerald-900"
        >
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Checkout</h1>
      <p className="text-gray-500 mt-2">
        Demo payments use Stripe test mode. Your card details are entered on
        Stripe. The final prices are confirmed by the server.
      </p>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mt-4">
          {error}
        </div>
      )}

      <div className="mt-8 flex flex-col lg:flex-row gap-8">
        <form
          onSubmit={handleSubmit}
          className="flex-1 space-y-5 bg-white rounded-2xl border border-gray-100 p-6"
        >
          <p className="text-sm text-gray-600">
            You will be redirected to Stripe Checkout to complete this test
            payment.
          </p>
          <button
            type="submit"
            disabled={placing}
            className="w-full rounded-xl bg-emerald-800 py-3.5 font-semibold text-white transition-colors hover:bg-emerald-900 disabled:opacity-50"
          >
            {placing
              ? "Opening Stripe Checkout..."
              : `Continue to payment · $${totalPrice.toFixed(2)}`}
          </button>
        </form>

        <div className="w-full lg:w-[380px]">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 sticky top-28">
            <h2 className="text-lg font-bold text-gray-900">Order Summary</h2>
            <div className="mt-4 divide-y divide-gray-100">
              {items.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-center gap-3 py-3"
                >
                  <img
                    src={item.product.image}
                    alt={item.product.name}
                    className="w-14 h-14 object-contain"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.product.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      Qty: {item.quantity}
                    </p>
                  </div>
                  <span className="text-sm font-semibold">
                    ${(item.product.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t flex justify-between">
              <span className="text-base font-semibold">
                Total ({totalItems} items)
              </span>
              <span className="text-xl font-bold">
                ${totalPrice.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
