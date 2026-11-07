import { Link } from "react-router-dom";
import type { Product } from "../../types/product";
import { isOnDeal, discountPercent } from "../../lib/deal";

export default function ProductCard({ product }: { product: Product }) {
  const onDeal = isOnDeal(product);
  const discount = discountPercent(product);

  return (
    <Link
      to={`/product/${product.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-2.5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-950/5 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
    >
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-stone-50 to-emerald-50/70 p-5">
        <img
          src={product.image}
          alt={product.name}
          className="h-full w-full object-contain transition duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <span className="absolute left-3 top-3 max-w-[70%] truncate rounded-full border border-white/80 bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-900 shadow-sm backdrop-blur">
          {product.category}
        </span>
        {!product.inStock && (
          <span className="absolute bottom-3 left-3 rounded-full bg-slate-900/90 px-2.5 py-1 text-[10px] font-semibold text-white">
            Out of stock
          </span>
        )}
        {onDeal && (
          <span className="absolute right-3 top-3 rounded-full bg-rose-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm">
            Save {discount}%
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-2 pb-2 pt-4">
        <div className="flex items-center gap-1.5 text-xs">
          <svg
            className="h-3.5 w-3.5 text-amber-500"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span className="font-semibold text-slate-700">{product.rating}</span>
          <span className="text-slate-400">/ 5</span>
        </div>

        <h3 className="mt-2 line-clamp-2 min-h-11 text-sm font-semibold leading-5 text-slate-900 transition-colors group-hover:text-emerald-800">
          {product.name}
        </h3>

        <div className="mt-3 flex items-baseline gap-2">
          <p className="text-lg font-bold tracking-tight text-slate-950">
            ${(onDeal ? product.salePrice! : product.price).toFixed(2)}
          </p>
          {onDeal && (
            <p className="text-xs font-medium text-slate-400 line-through">
              ${product.price.toFixed(2)}
            </p>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-semibold">
          <span
            className={product.inStock ? "text-emerald-700" : "text-slate-400"}
          >
            {product.inStock ? "Available now" : "Currently unavailable"}
          </span>
          <span className="inline-flex items-center gap-1 text-emerald-800 transition-transform group-hover:translate-x-0.5">
            Details
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 12h14m-6-6 6 6-6 6"
              />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}
