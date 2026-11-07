import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useProducts } from "../hooks/useProducts";
import ProductGrid from "../components/products/ProductGrid";
import RecommendedRail from "../components/products/RecommendedRail";

export default function HomePage() {
  const [searchParams] = useSearchParams();
  const search = searchParams.get("search") || undefined;
  const { products, loading } = useProducts({ search });
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = useMemo(
    () => [...new Set(products.map((product) => product.category))].sort(),
    [products],
  );
  const activeCategory = categories.includes(selectedCategory)
    ? selectedCategory
    : "All";
  const visibleProducts =
    activeCategory === "All"
      ? products
      : products.filter((product) => product.category === activeCategory);

  return (
    <>
      <div className="mx-auto max-w-[1360px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        {!search && (
          <section className="relative isolate overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800 px-6 py-10 text-white shadow-xl shadow-emerald-950/10 sm:px-10 sm:py-14 lg:px-14 lg:py-16">
            <div className="pointer-events-none absolute -right-20 -top-32 -z-10 h-96 w-96 rounded-full border border-white/10" />
            <div className="pointer-events-none absolute -right-8 -top-20 -z-10 h-72 w-72 rounded-full border border-white/10" />
            <div className="pointer-events-none absolute -bottom-36 right-1/4 -z-10 h-72 w-72 rounded-full bg-lime-300/10 blur-3xl" />

            <div className="relative max-w-2xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
                <span className="h-1.5 w-1.5 rounded-full bg-lime-300" />A
                smarter way to shop
              </p>
              <h1 className="mt-6 max-w-xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
                Good finds.
                <span className="block text-lime-200">Better everyday.</span>
              </h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-emerald-50/80 sm:text-lg">
                Explore thoughtful picks across the catalog, with
                recommendations that get more useful as you browse.
              </p>
              <a
                href="#catalog"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-lime-300 px-6 py-3 text-sm font-bold text-emerald-950 transition hover:bg-lime-200 focus:outline-none focus:ring-2 focus:ring-lime-200 focus:ring-offset-2 focus:ring-offset-emerald-900"
              >
                Explore the collection
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </a>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 border-t border-white/15 pt-5 text-xs font-medium text-emerald-50/80 sm:text-sm lg:absolute lg:bottom-10 lg:right-12 lg:mt-0 lg:border-0 lg:pt-0">
              <span className="inline-flex items-center gap-2">
                <span className="text-lime-300">✦</span> Curated product picks
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="text-lime-300">✦</span> Personal
                recommendations
              </span>
            </div>
          </section>
        )}

        {!search && <RecommendedRail />}

        <section id="catalog" className={!search ? "pt-14" : "pt-4"}>
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
                {search ? "Search the store" : "The collection"}
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                {search ? `Results for “${search}”` : "Find your next favorite"}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {loading
                  ? "Finding products for you…"
                  : `${visibleProducts.length} ${
                      visibleProducts.length === 1 ? "product" : "products"
                    } to explore`}
              </p>
            </div>
            {!search && (
              <span className="hidden items-center gap-2 text-sm font-medium text-slate-500 sm:inline-flex">
                <svg
                  className="h-4 w-4 text-emerald-700"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 3v2m7.07.93-1.42 1.42M21 12h-2M5 12H3m3.35-5.65L4.93 4.93m12.72 12.72 1.42 1.42M12 19v2m-5.65-3.35-1.42 1.42M12 7a5 5 0 100 10 5 5 0 000-10z"
                  />
                </svg>
                Picked for everyday living
              </span>
            )}
          </div>

          {!search && categories.length > 0 && (
            <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
              {["All", ...categories].map((category) => {
                const isActive = activeCategory === category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedCategory(category)}
                    aria-pressed={isActive}
                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                      isActive
                        ? "bg-emerald-900 text-white shadow-sm"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-800"
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-7">
            <ProductGrid products={visibleProducts} loading={loading} />
          </div>
        </section>
      </div>

      <footer className="bg-emerald-950 text-emerald-50">
        <div className="mx-auto grid max-w-[1360px] gap-10 px-6 py-12 sm:grid-cols-2 sm:px-8 lg:grid-cols-[1fr_auto_auto] lg:items-start lg:px-10">
          <div className="max-w-sm">
            <Link
              to="/"
              className="text-xl font-bold tracking-tight text-white focus:outline-none focus:ring-2 focus:ring-lime-300"
            >
              Shop<span className="text-lime-300">Pilot</span>
            </Link>
            <p className="mt-3 text-sm leading-6 text-emerald-100/75">
              Thoughtful finds for everyday living. Browse the collection and
              discover something new.
            </p>
          </div>

          <nav aria-label="Footer: explore">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
              Explore
            </h2>
            <ul className="mt-4 space-y-3 text-sm text-emerald-100/75">
              <li>
                <a className="transition hover:text-lime-300" href="#catalog">
                  Shop all products
                </a>
              </li>
              <li>
                <Link className="transition hover:text-lime-300" to="/cart">
                  Shopping cart
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="Footer: account">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
              Your account
            </h2>
            <ul className="mt-4 space-y-3 text-sm text-emerald-100/75">
              <li>
                <Link className="transition hover:text-lime-300" to="/login">
                  Sign in
                </Link>
              </li>
              <li>
                <Link className="transition hover:text-lime-300" to="/signup">
                  Create an account
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-[1360px] flex-col gap-2 px-6 py-5 text-xs text-emerald-100/60 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
            <p>
              © {new Date().getFullYear()} ShopPilot. Built as a local demo
              storefront.
            </p>
            <p>Stripe test payments only · No live charges</p>
          </div>
        </div>
      </footer>
    </>
  );
}
