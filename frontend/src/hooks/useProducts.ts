import { useState, useEffect } from "react";
import type { Product, ProductFilters } from "../types/product";
import { recordEvent } from "../lib/history";

export function useProducts(filters: ProductFilters) {
  const params = new URLSearchParams();
  if (filters.category) params.set("category", filters.category);
  if (filters.search) params.set("search", filters.search);
  if (filters.minPrice) params.set("minPrice", filters.minPrice);
  if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
  const query = params.toString();
  const [result, setResult] = useState<{
    query: string;
    products: Product[];
  } | null>(null);

  useEffect(() => {
    const search = filters.search?.trim();
    if (search) recordEvent({ type: "SEARCH", query: search });

    let active = true;
    fetch(`/api/products?${query}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Product request failed: ${res.status}`);
        return res.json() as Promise<{ products?: Product[] }>;
      })
      .then((data) => {
        if (active) {
          setResult({
            query,
            products: Array.isArray(data.products) ? data.products : [],
          });
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error("Unable to load products", error);
        setResult({ query, products: [] });
      });

    return () => {
      active = false;
    };
  }, [filters.search, query]);

  return {
    products: result?.query === query ? result.products : [],
    loading: result?.query !== query,
  };
}
