import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import type { Product } from "../../types/product";
import ProductRail from "./ProductRail";

function getToken(): string | null {
  try {
    const s = localStorage.getItem("auth");
    return s ? (JSON.parse(s).accessToken ?? null) : null;
  } catch {
    return null;
  }
}

export default function RecommendedRail() {
  const { user } = useAuth();
  const [recs, setRecs] = useState<Product[]>([]);
  const [personalized, setPersonalized] = useState(false);
  const [popular, setPopular] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    const token = getToken();
    const recsP = fetch(
      "/api/products/recommendations",
      token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    )
      .then((r) => (r.ok ? r.json() : { personalized: false, products: [] }))
      .then((d: { personalized?: boolean; products?: Product[] }) => {
        setPersonalized(Boolean(d?.personalized));
        setRecs(Array.isArray(d?.products) ? d.products : []);
      })
      .catch(() => {});

    const popP = fetch("/api/products")
      .then((r) => (r.ok ? r.json() : { products: [] }))
      .then((d: { products?: Product[] }) =>
        setPopular(Array.isArray(d?.products) ? d.products : []),
      )
      .catch(() => {});

    Promise.allSettled([recsP, popP]).then(() => setLoading(false));
  }, []);
  useEffect(() => {
    load();
  }, [user?.id, load]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [load]);

  const recIds = new Set(personalized ? recs.map((p) => p.id) : []);
  const popularFiltered = popular.filter((p) => !recIds.has(p.id));
  return (
    <>
      {personalized && recs.length > 0 && (
        <ProductRail
          eyebrow="For you"
          title="Recommended for you"
          subtitle="Based on your recent browsing"
          products={recs}
          loading={false}
          showReasons
        />
      )}
      <ProductRail
        eyebrow="Trending"
        title="Popular right now"
        products={popularFiltered}
        loading={loading}
      />
    </>
  );
}
