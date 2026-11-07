import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useCart } from "../hooks/useCart";

export default function PaymentResultPage() {
  const { authFetch } = useAuth();
  const { clearCart } = useCart();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const orderId = searchParams.get("order_id");
  const canceled = location.pathname.endsWith("/cancel");
  const missingOrderId = !canceled && !orderId;
  const [status, setStatus] = useState<
    "checking" | "paid" | "pending" | "error"
  >(canceled ? "pending" : missingOrderId ? "error" : "checking");
  const [error, setError] = useState(
    missingOrderId
      ? "The payment return did not include an order reference."
      : "",
  );

  useEffect(() => {
    if (canceled || !orderId) return;

    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    const check = async () => {
      try {
        const response = await authFetch(
          `/api/orders/${encodeURIComponent(orderId)}/payment-status`,
        );
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.message || "Unable to confirm this payment.");
        }
        const result = (await response.json()) as { status: string };
        if (!active) return;
        if (result.status === "paid") {
          setStatus("paid");
          clearCart();
          sessionStorage.removeItem("shoppilot-checkout-idempotency");
          return;
        }
        if (
          result.status === "payment_failed" ||
          result.status === "payment_expired"
        ) {
          setStatus("error");
          setError(
            "The payment was not completed. Your cart is still available.",
          );
          return;
        }
        attempts += 1;
        if (attempts >= 15) {
          setStatus("pending");
          return;
        }
        timer = setTimeout(check, 2000);
      } catch (err: unknown) {
        if (!active) return;
        setStatus("error");
        setError(
          err instanceof Error
            ? err.message
            : "Unable to confirm this payment.",
        );
      }
    };
    void check();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [authFetch, canceled, clearCart, orderId]);

  return (
    <div className="max-w-[760px] mx-auto px-6 py-20 text-center">
      <h1 className="text-2xl font-bold text-gray-900">
        {canceled
          ? "Payment canceled"
          : status === "paid"
            ? "Payment successful"
            : status === "checking" || status === "pending"
              ? "Confirming your payment"
              : "Payment not confirmed"}
      </h1>
      <p className="text-gray-500 mt-3">
        {canceled
          ? "Your cart is unchanged. You can return to checkout whenever you are ready."
          : status === "paid"
            ? "Your order is paid and confirmed."
            : status === "pending"
              ? "Stripe has returned, but confirmation is taking longer than usual. Refresh this page shortly or check your orders."
              : status === "error"
                ? error
                : "We are checking the verified payment status with the store."}
      </p>
      {orderId && (
        <p className="text-sm text-gray-400 mt-2">Order: {orderId}</p>
      )}
      <Link
        to={canceled || status !== "paid" ? "/checkout" : "/"}
        className="inline-block mt-8 rounded-xl bg-emerald-800 px-8 py-3 font-semibold text-white transition-colors hover:bg-emerald-900"
      >
        {canceled || status !== "paid"
          ? "Return to checkout"
          : "Continue shopping"}
      </Link>
    </div>
  );
}
