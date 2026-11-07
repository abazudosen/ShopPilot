import type { Product } from "../types/product";

export function isOnDeal(
  p: Pick<Product, "price" | "salePrice" | "dealExpiresAt">,
): boolean {
  if (p.salePrice == null || p.salePrice >= p.price) return false;
  if (p.dealExpiresAt && new Date(p.dealExpiresAt).getTime() <= Date.now())
    return false;
  return true;
}

export function effectivePrice(
  p: Pick<Product, "price" | "salePrice" | "dealExpiresAt">,
): number {
  return isOnDeal(p) ? (p.salePrice as number) : p.price;
}

export function discountPercent(
  p: Pick<Product, "price" | "salePrice" | "dealExpiresAt">,
): number {
  if (!isOnDeal(p)) return 0;
  return Math.round((1 - (p.salePrice as number) / p.price) * 100);
}
