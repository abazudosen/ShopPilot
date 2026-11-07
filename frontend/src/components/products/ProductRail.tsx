import ProductCard from "./ProductCard";
import type { Product } from "../../types/product";

function rowClamp(i: number, disp: "flex" | "block"): string {
  if (i < 4) return "";
  if (disp === "flex") return i < 6 ? "hidden sm:flex" : "hidden md:flex";
  return i < 6 ? "hidden sm:block" : "hidden md:block";
}

export default function ProductRail({
  eyebrow,
  title,
  subtitle,
  products,
  loading,
  showReasons,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  products: Product[];
  loading: boolean;
  showReasons?: boolean;
}) {
  if (!loading && products.length === 0) return null;

  return (
    <section className="max-w-[1280px] mx-auto px-6 pt-12">
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
            {eyebrow}
          </p>
          <h2 className="text-2xl font-bold text-gray-900 mt-1 tracking-tight">
            {title}
          </h2>
        </div>
        {subtitle && (
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-gray-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {subtitle}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className={`bg-white rounded-xl border border-gray-100 h-[260px] animate-pulse ${rowClamp(i, "block")}`}
              />
            ))
          : products.slice(0, 8).map((p, i) => (
              <div
                key={p.id}
                className={`flex flex-col gap-1.5 ${rowClamp(i, "flex")}`}
              >
                <ProductCard product={p} />
                {showReasons && p.reason && (
                  <span className="truncate px-1 text-[11px] font-medium text-emerald-800">
                    ✦ {p.reason}
                  </span>
                )}
              </div>
            ))}
      </div>
    </section>
  );
}
