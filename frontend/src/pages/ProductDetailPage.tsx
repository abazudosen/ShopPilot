import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import type { Product } from "../types/product";
import { useCart } from "../hooks/useCart";
import { recordEvent } from "../lib/history";
import { isOnDeal } from "../lib/deal";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<{
    id: string | undefined;
    product: Product | null;
  } | null>(null);
  const loading = result === null || result.id !== id;
  const product = loading ? null : result.product;
  const [added, setAdded] = useState(false);
  const { addToCart } = useCart();

  useEffect(() => {
    let active = true;
    fetch(`/api/products/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json() as Promise<Product>;
      })
      .then((data) => {
        if (!active) return;
        setResult({ id, product: data });
        if (data?.id) recordEvent({ type: "VIEW", productId: data.id });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof Error && error.message !== "Not found") {
          console.error("Unable to load product", error);
        }
        setResult({ id, product: null });
      });
    return () => {
      active = false;
    };
  }, [id]);

  function handleAddToCart() {
    if (!product || !product.inStock) return;
    addToCart(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[1360px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="animate-pulse">
          <div className="h-4 w-48 rounded bg-slate-200" />
          <div className="mt-8 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="aspect-[4/3] rounded-[2rem] bg-emerald-50" />
            <div className="space-y-5 py-5">
              <div className="h-4 w-28 rounded bg-slate-200" />
              <div className="h-10 w-3/4 rounded bg-slate-200" />
              <div className="h-5 w-32 rounded bg-slate-200" />
              <div className="h-8 w-40 rounded bg-slate-200" />
              <div className="h-24 rounded bg-slate-200" />
              <div className="h-12 w-48 rounded-full bg-slate-200" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-[1360px] px-4 py-24 text-center sm:px-6 lg:px-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
          <svg
            className="h-7 w-7"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.7}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 3h2l2.4 11.2a2 2 0 002 1.6h8.8a2 2 0 002-1.6L22 7H6m4 13h.01M18 20h.01"
            />
          </svg>
        </div>
        <h2 className="mt-5 text-2xl font-semibold text-slate-950">
          Product not found
        </h2>
        <p className="mt-2 text-slate-500">
          This item may have moved or is no longer available.
        </p>
        <Link
          to="/"
          className="mt-7 inline-flex rounded-full bg-emerald-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
        >
          Return to the collection
        </Link>
      </div>
    );
  }

  const onDeal = isOnDeal(product);
  const currentPrice = onDeal ? product.salePrice! : product.price;

  return (
    <div className="mx-auto max-w-[1360px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-2 text-sm text-slate-400"
      >
        <Link
          to="/"
          className="font-medium transition-colors hover:text-emerald-800"
        >
          Home
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-slate-500">{product.category}</span>
        <span aria-hidden="true">/</span>
        <span className="max-w-[220px] truncate font-medium text-slate-700">
          {product.name}
        </span>
      </nav>

      <div className="mt-7 grid items-start gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
        <div className="relative overflow-hidden rounded-[2rem] border border-emerald-100/80 bg-gradient-to-br from-stone-50 via-white to-emerald-50 p-8 sm:p-12">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-100/50 blur-3xl" />
          {onDeal && (
            <span className="absolute left-6 top-6 z-10 rounded-full bg-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm sm:left-8 sm:top-8">
              Special offer
            </span>
          )}
          <div className="relative flex aspect-square items-center justify-center">
            <img
              src={product.image}
              alt={product.name}
              className="max-h-full max-w-full object-contain drop-shadow-sm"
            />
          </div>
          <div className="relative mt-5 flex items-center justify-center gap-2 text-xs font-medium text-emerald-900/70">
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 3a11.955 11.955 0 01-8.618 2.984A12.02 12.02 0 003 9c0 5.591 3.824 10.291 9 11.622C17.176 19.291 21 14.591 21 9c0-1.042-.133-2.053-.382-3.016z"
              />
            </svg>
            A closer look at your next favorite
          </div>
        </div>

        <section className="rounded-[2rem] border border-slate-200/80 bg-white p-6 shadow-sm sm:p-9">
          <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">
            {product.category}
          </span>
          <h1 className="mt-5 text-3xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-4xl">
            {product.name}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, index) => (
                <svg
                  key={index}
                  className={`h-4 w-4 ${
                    index < Math.round(product.rating)
                      ? "text-amber-500"
                      : "text-slate-200"
                  }`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span className="text-sm font-semibold text-slate-700">
              {product.rating}
              <span className="font-normal text-slate-400"> / 5</span>
            </span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span
              className={`text-sm font-semibold ${
                product.inStock ? "text-emerald-700" : "text-rose-600"
              }`}
            >
              {product.inStock ? "Available now" : "Currently unavailable"}
            </span>
          </div>

          <div className="mt-7 border-y border-slate-100 py-5">
            <div className="flex flex-wrap items-baseline gap-3">
              <p className="text-4xl font-bold tracking-tight text-slate-950">
                ${currentPrice.toFixed(2)}
              </p>
              {onDeal && (
                <>
                  <p className="text-lg font-medium text-slate-400 line-through">
                    ${product.price.toFixed(2)}
                  </p>
                  <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">
                    You save ${(product.price - currentPrice).toFixed(2)}
                  </span>
                </>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Demo pricing shown in USD. Final order totals are calculated by
              the server.
            </p>
          </div>

          <p className="mt-6 whitespace-pre-line text-[15px] leading-7 text-slate-600">
            {product.description}
          </p>

          {product.features.length > 0 && (
            <div className="mt-7">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                Product highlights
              </h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {product.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 rounded-xl bg-emerald-50/70 px-3 py-2.5 text-sm font-medium text-emerald-950"
                  >
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!product.inStock}
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-900 px-7 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-950/10 transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none sm:w-auto"
          >
            {added ? (
              <>
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Added to cart
              </>
            ) : (
              <>
                Add to cart
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
                  />
                </svg>
              </>
            )}
          </button>
        </section>
      </div>
    </div>
  );
}
