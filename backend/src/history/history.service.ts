import { Injectable, Logger } from '@nestjs/common';
import { EventType, Prisma } from '../prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RecordEventDto } from './dto/record-event.dto';
import { PreferenceProfile } from './interfaces/preference-profile.interface';

const MAX_EVENTS = 60;
const HALF_LIFE_DAYS = 14;

const TYPE_WEIGHT: Record<EventType, number> = {
  PURCHASE: 5,
  CART_ADD: 3,
  VIEW: 1,
  SEARCH: 1,
  CART_REMOVE: -2,
};

type EventWithProduct = Prisma.UserEventGetPayload<{
  include: { product: true };
}>;

@Injectable()
export class HistoryService {
  private readonly logger = new Logger(HistoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordEvent(userId: string, dto: RecordEventDto): Promise<void> {
    if (!userId) return;
    try {
      await this.prisma.userEvent.create({
        data: {
          userId,
          type: dto.type,
          productId: dto.productId ?? null,
          query: dto.query ?? null,
          quantity: dto.quantity ?? null,
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to record ${dto.type} event: ${String(error)}`);
    }
  }

  async getProfile(userId: string | undefined): Promise<PreferenceProfile> {
    const empty: PreferenceProfile = {
      hasHistory: false,
      topCategories: [],
      recentProducts: [],
      purchasedProducts: [],
      recentQueries: [],
    };

    if (!userId) return empty;

    let events: EventWithProduct[];
    try {
      events = await this.prisma.userEvent.findMany({
        where: { userId },
        include: { product: true },
        orderBy: { createdAt: 'desc' },
        take: MAX_EVENTS,
      });
    } catch (error) {
      this.logger.warn(`Failed to load history: ${String(error)}`);
      return empty;
    }

    if (events.length === 0) return empty;

    const now = Date.now();
    const categoryScore = new Map<string, number>();
    const priceSamples: Array<{ price: number; weight: number }> = [];
    const recentProducts: string[] = [];
    const purchasedProducts: string[] = [];
    const recentQueries: string[] = [];

    for (const event of events) {
      const recency = this.recencyWeight(now, event.createdAt);
      const weight = TYPE_WEIGHT[event.type] * recency;

      if (event.product) {
        const { name, category, price } = event.product;

        if (weight > 0) {
          categoryScore.set(category, (categoryScore.get(category) ?? 0) + weight);
          priceSamples.push({ price: Number(price), weight });
        }
        if (event.type === 'PURCHASE') pushUnique(purchasedProducts, name, 5);
        if (weight > 0) pushUnique(recentProducts, name, 8);
      }

      if (event.type === 'SEARCH' && event.query) {
        pushUnique(recentQueries, event.query, 5);
      }
    }

    const topCategories = [...categoryScore.entries()]
      .filter(([, score]) => score > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category]) => category);

    return {
      hasHistory: true,
      topCategories,
      priceBand: this.computePriceBand(priceSamples),
      recentProducts,
      purchasedProducts,
      recentQueries,
    };
  }

  private recencyWeight(now: number, createdAt: Date): number {
    const ageDays = (now - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
  }

  private computePriceBand(
    samples: Array<{ price: number; weight: number }>,
  ): PreferenceProfile['priceBand'] {
    if (samples.length === 0) return undefined;

    const totalWeight = samples.reduce((s, x) => s + x.weight, 0);
    if (totalWeight <= 0) return undefined;

    const avg =
      samples.reduce((s, x) => s + x.price * x.weight, 0) / totalWeight;
    const prices = samples.map((x) => x.price);

    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg: Math.round(avg * 100) / 100,
    };
  }
}

function pushUnique(list: string[], value: string, max: number): void {
  if (list.length >= max || list.includes(value)) return;
  list.push(value);
}
