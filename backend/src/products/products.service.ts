import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ProductQueryDto } from "./dto/product-query.dto";
import { SearchService } from "../search/search.service";
import { EmbeddingService } from "../search/embedding.service";
import { Product } from "./interfaces/product.interface";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { PreferenceProfile } from "../history/interfaces/preference-profile.interface";

function toProduct(p: {
  id: string;
  name?: string | null;
  description?: string | null;
  price?: number | string | { toNumber(): number } | null;
  category?: string | null;
  image?: string | null;
  rating?: number | string | { toNumber(): number } | null;
  inStock?: boolean | null;
  features?: string[] | null;
  salePrice?: number | string | { toNumber(): number } | null;
  dealExpiresAt?: Date | string | null;
  sellerId?: string | null;
  [key: string]: any;
}): Product {
  return {
    id: p.id,
    name: p.name ?? "",
    description: p.description ?? "",
    price: Number(p.price ?? 0),
    category: p.category ?? "",
    image: p.image ?? "",
    rating: Number(p.rating ?? 0),
    inStock: p.inStock ?? false,
    features: Array.isArray(p.features) ? p.features : [],
    salePrice: p.salePrice != null ? Number(p.salePrice) : null,
    dealExpiresAt:
      p.dealExpiresAt instanceof Date
        ? p.dealExpiresAt.toISOString()
        : (p.dealExpiresAt ?? null),
    sellerId: p.sellerId ?? null,
  };
}

export function isProductOnDeal(p: Product): boolean {
  if (p.salePrice == null || p.salePrice >= p.price) return false;
  if (p.dealExpiresAt && new Date(p.dealExpiresAt).getTime() <= Date.now()) {
    return false;
  }
  return true;
}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async create(dto: CreateProductDto, sellerId: string): Promise<Product> {
    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        category: dto.category,
        image: dto.image,
        features: dto.features,
        rating: dto.rating ?? 0,
        inStock: dto.inStock ?? true,
        sellerId,
      },
    });

    return toProduct(product);
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    sellerId: string,
  ): Promise<Product> {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Product with id "${id}" not found`);
    }
    if (existing.sellerId !== sellerId) {
      throw new ForbiddenException("You can only edit your own products");
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: dto,
    });
    return toProduct(updated);
  }

  async findBySellerId(sellerId: string): Promise<Product[]> {
    const rows = await this.prisma.product.findMany({
      where: { sellerId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toProduct);
  }

  async findByIds(ids: string[]): Promise<Product[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.product.findMany({
      where: { id: { in: ids } },
    });
    const productMap = new Map(
      rows.map((p) => [p.id, toProduct(p)] as const),
    );
    return ids
      .map((id) => productMap.get(id))
      .filter((p): p is Product => p !== undefined);
  }

  private isNaturalLanguageQuery(raw: string): boolean {
    const text = raw.trim().toLowerCase();
    const words = text.split(/\s+/).filter(Boolean);

    if (words.length >= 4) return true;

    const intent =
      /\b(under|below|over|above|less|more|than|cheap|cheapest|affordable|budget|best|top|good|great|premium|for|with|that|like|recommend|suggest|need|want|around|between|gaming|photography|work|travel|gift|student|business)\b/;
    if (intent.test(text)) return true;

    if (/\$|\d{3,}/.test(text)) return true;

    return false;
  }

  private async popularPicks(limit: number): Promise<Product[]> {
    const rows = await this.prisma.product.findMany({
      where: { inStock: true },
      orderBy: { rating: "desc" },
      take: limit,
    });
    return rows.map(toProduct);
  }

  async recommendForProfile(
    profile: PreferenceProfile,
    limit = 8,
  ): Promise<Product[]> {
    const signals = [
      ...profile.recentQueries,
      ...profile.recentProducts,
      ...profile.topCategories,
    ].filter(Boolean);

    if (signals.length === 0) {
      return this.popularPicks(limit);
    }

    const query = signals.join(", ");
    let results: { id: string; score: number }[];
    try {
      const embedding = await this.embeddingService.generateEmbedding(query);
      results = await this.searchService.search(
        embedding,
        limit + profile.purchasedProducts.length + 12,
      );
    } catch (error) {
      this.logger.warn(
        `Personalized recommendations unavailable, falling back to popular picks: ${String(error)}`,
      );
      return this.popularPicks(limit);
    }
    if (results.length === 0) return this.popularPicks(limit);

    const scoreById = new Map(results.map((r) => [r.id, r.score]));
    const maxScore = Math.max(...results.map((r) => r.score), 1);

    const rows = await this.prisma.product.findMany({
      where: { id: { in: results.map((r) => r.id) } },
    });
    const purchased = new Set(profile.purchasedProducts);
    const candidates = rows
      .map(toProduct)
      .filter((p: { name: string }) => !purchased.has(p.name));

    const band = profile.priceBand;
    const pad = band ? (band.max - band.min) * 0.25 || band.max * 0.25 : 0;
    const scored = candidates.map((p: Product) => {
      const sem = (scoreById.get(p.id) ?? 0) / maxScore;
      const rating = p.rating / 5;
      const stock = p.inStock ? 1 : 0;
      const deal = isProductOnDeal(p) ? 1 : 0;
      const inBand =
        band && p.price >= band.min - pad && p.price <= band.max + pad ? 1 : 0;
      const score =
        sem * 0.55 + rating * 0.2 + stock * 0.1 + deal * 0.1 + inBand * 0.05;
      return { p, score };
    });
    scored.sort(
      (a: { score: number }, b: { score: number }) => b.score - a.score,
    );

    const perCategory = new Map<string, number>();
    const picked: Product[] = [];
    const MAX_PER_CATEGORY = 3;
    for (const { p } of scored) {
      const count = perCategory.get(p.category) ?? 0;
      if (count >= MAX_PER_CATEGORY) continue;
      perCategory.set(p.category, count + 1);
      picked.push(p);
      if (picked.length >= limit) break;
    }
    if (picked.length < limit) {
      for (const { p } of scored) {
        if (picked.includes(p)) continue;
        picked.push(p);
        if (picked.length >= limit) break;
      }
    }

    return picked;
  }

  recommendationReason(product: Product, profile: PreferenceProfile): string {
    if (isProductOnDeal(product)) {
      const off = Math.round(
        (1 - (product.salePrice as number) / product.price) * 100,
      );
      return `On sale, ${off}% off`;
    }
    if (profile.topCategories.includes(product.category)) {
      return `Because you like ${product.category}`;
    }
    if (profile.recentProducts.length > 0) {
      return `Similar to ${profile.recentProducts[0]}`;
    }
    if (product.rating >= 4.5) return "Highly rated pick";
    return `Popular in ${product.category}`;
  }

  async searchByRelevance(query: string): Promise<Product[]> {
    let searchResults: { id: string; score: number }[];
    try {
      const embedding = await this.embeddingService.generateEmbedding(query);
      searchResults = await this.searchService.search(embedding, 10);
    } catch (error) {
      this.logger.warn(
        `Semantic product search unavailable; using keyword search: ${String(error)}`,
      );
      searchResults = await this.searchService.searchWithFilters({ text: query });
    }

    if (searchResults.length === 0) return [];

    const ids = searchResults.map((r) => r.id);
    const rows = await this.prisma.product.findMany({
      where: { id: { in: ids } },
    });

    const productMap = new Map(
      rows.map((p) => [p.id, toProduct(p)]),
    );
    return ids
      .map((id) => productMap.get(id))
      .filter((p): p is Product => p !== undefined);
  }

  async findAll(
    query: ProductQueryDto,
  ): Promise<{ products: Product[]; total: number }> {
    const hasFilters =
      query.search || query.category || query.minPrice || query.maxPrice;

    if (hasFilters) {
      let searchResults;

      if (query.search) {
        const filters = {
          category: query.category,
          minPrice: query.minPrice ? Number(query.minPrice) : undefined,
          maxPrice: query.maxPrice ? Number(query.maxPrice) : undefined,
        };

        if (this.isNaturalLanguageQuery(query.search)) {
          try {
            const embedding = await this.embeddingService.generateEmbedding(
              query.search,
            );
            searchResults = await this.searchService.searchWithFilters({
              embedding,
              ...filters,
            });
          } catch (error) {
            this.logger.warn(
              `Semantic product search unavailable; using keyword search: ${String(error)}`,
            );
            searchResults = await this.searchService.searchWithFilters({
              text: query.search,
              ...filters,
            });
          }
        } else {
          // Simple keyword(s) → fast BM25 keyword search (no embedding cost).
          searchResults = await this.searchService.searchWithFilters({
            text: query.search,
            ...filters,
          });
        }
      } else {
        searchResults = await this.searchService.searchWithFilters({
          category: query.category,
          minPrice: query.minPrice ? Number(query.minPrice) : undefined,
          maxPrice: query.maxPrice ? Number(query.maxPrice) : undefined,
        });
      }
      if (searchResults.length === 0) {
        return { products: [], total: 0 };
      }

      const ids = searchResults.map((r) => r.id);
      const rows = await this.prisma.product.findMany({
        where: { id: { in: ids } },
      });
      const productMap = new Map(
        rows.map(
          (p) => [p.id, toProduct(p)],
        ),
      );
      const ordered = ids
        .map((id) => productMap.get(id))
        .filter((p): p is Product => p !== undefined);

      return { products: ordered, total: ordered.length };
    }
    const rows = await this.prisma.product.findMany({
      orderBy: { rating: "desc" },
    });
    const products = rows.map(toProduct);
    return { products, total: products.length };
  }

  async getDeals(): Promise<Product[]> {
    const now = new Date();
    const rows = await this.prisma.product.findMany({
      where: {
        salePrice: { not: null },
        OR: [{ dealExpiresAt: null }, { dealExpiresAt: { gt: now } }],
      },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map(toProduct);
  }

  async findById(id: string): Promise<Product | null> {
    const p = await this.prisma.product.findUnique({ where: { id } });
    return p ? toProduct(p) : null;
  }

  async getCategories(): Promise<string[]> {
    const results = await this.prisma.product.findMany({
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    });
    return results.map((r: { category: any }) => r.category);
  }
}
