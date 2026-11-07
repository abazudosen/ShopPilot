export interface PreferenceProfile {
  hasHistory: boolean;
  topCategories: string[];
  priceBand?: { min: number; max: number; avg: number };
  recentProducts: string[];
  purchasedProducts: string[];
  recentQueries: string[];
}
