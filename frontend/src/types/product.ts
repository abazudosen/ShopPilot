export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  rating: number;
  inStock: boolean;
  features: string[];
  sellerId?: string | null;
  salePrice?: number | null;
  dealExpiresAt?: string | null;
  reason?: string;
}

export interface ProductFilters {
  category?: string;
  search?: string;
  minPrice?: string;
  maxPrice?: string;
}
