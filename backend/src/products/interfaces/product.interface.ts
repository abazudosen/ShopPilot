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
  salePrice: number | null;
  dealExpiresAt: string | null;
  sellerId: string | null;
}
