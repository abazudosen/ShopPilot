import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@opensearch-project/opensearch';

export interface ProductSearchResult {
  id: string;
  score: number;
}

export interface ProductDoc {
  id: string;
  name: string;
  description: string;
  category: string;
  features: string[];
  price: number;
  rating: number;
  inStock: boolean;
  image: string;
}

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private client: Client;
  private readonly INDEX = 'products';

  constructor(private configService: ConfigService) {
    this.client = new Client({
      node: this.configService.get<string>(
        'OPENSEARCH_NODE',
        'http://localhost:9200',
      ),
    });
  }

  async onModuleInit() {
    try {
      await this.createIndexIfNotExists();
    } catch {
      this.logger.warn(
        'Could not connect to OpenSearch. Search features will be unavailable.',
      );
    }
  }

  async createIndexIfNotExists() {
    const exists = await this.client.indices.exists({ index: this.INDEX });
    if (exists.body) return;

    await this.client.indices.create({
      index: this.INDEX,
      body: {
        settings: {
          'index.knn': true,
          number_of_shards: 1,
          number_of_replicas: 0,
        },
        mappings: {
          properties: {
            name: { type: 'text', boost: 3 },
            description: { type: 'text', boost: 2 },
            category: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            features: { type: 'text' },
            price: { type: 'float' },
            rating: { type: 'float' },
            inStock: { type: 'boolean' },
            image: { type: 'keyword', index: false },
            embedding: {
              type: 'knn_vector',
              dimension: 1536,
              method: { name: 'hnsw', space_type: 'l2', engine: 'nmslib' },
            },
          },
        },
      },
    });

    this.logger.log('Created OpenSearch products index with knn_vector');
  }

  async indexProduct(product: ProductDoc, embedding: number[]) {
    await this.client.index({
      index: this.INDEX,
      id: product.id,
      body: {
        name: product.name,
        description: product.description,
        category: product.category,
        features: product.features.join(' '),
        price: product.price,
        rating: product.rating,
        inStock: product.inStock,
        image: product.image,
        embedding,
      },
      refresh: true,
    });
  }

  async searchWithFilters(params: {
    embedding?: number[];
    text?: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
  }): Promise<ProductSearchResult[]> {
    try {
      const filter: any[] = [];

      if (params.category) {
        filter.push({ term: { 'category.keyword': params.category } });
      }

      if (params.minPrice !== undefined || params.maxPrice !== undefined) {
        const range: any = {};
        if (params.minPrice !== undefined) range.gte = params.minPrice;
        if (params.maxPrice !== undefined) range.lte = params.maxPrice;
        filter.push({ range: { price: range } });
      }

      let query: any;

      let must: any;
      if (params.embedding) {
        must = { knn: { embedding: { vector: params.embedding, k: 100 } } };
      } else if (params.text) {
        must = {
          multi_match: {
            query: params.text,
            fields: ['name^3', 'description^2', 'category', 'features'],
            type: 'best_fields',
            fuzziness: 'AUTO',
          },
        };
      } else {
        must = { match_all: {} };
      }

      if (filter.length > 0) {
        query = { bool: { must: [must], filter } };
      } else {
        query = params.embedding || params.text ? must : { bool: { must: [must] } };
      }

      const sortByRating = !params.embedding && !params.text;

      const result = await this.client.search({
        index: this.INDEX,
        body: {
          size: 100,
          query,
          ...(sortByRating ? { sort: [{ rating: 'desc' }] } : {}),
        },
      });

      return result.body.hits.hits.map((hit: any) => ({
        id: hit._id as string,
        score: hit._score as number,
      }));
    } catch {
      this.logger.warn(
        'OpenSearch searchWithFilters failed, returning empty results',
      );
      return [];
    }
  }

  async search(
    queryEmbedding: number[],
    size = 10,
  ): Promise<ProductSearchResult[]> {
    try {
      const result = await this.client.search({
        index: this.INDEX,
        body: {
          size,
          query: {
            knn: {
              embedding: {
                vector: queryEmbedding,
                k: size,
              },
            },
          },
        },
      });

      return result.body.hits.hits.map((hit: any) => ({
        id: hit._id as string,
        score: hit._score as number,
      }));
    } catch {
      this.logger.warn('OpenSearch knn search failed, returning empty results');
      return [];
    }
  }

  async bulkIndexProducts(
    products: Array<ProductDoc & { embedding?: number[] }>,
  ) {
    if (products.length === 0) return;

    const body = products.flatMap((product) => [
      { index: { _index: this.INDEX, _id: product.id } },
      {
        name: product.name,
        description: product.description,
        category: product.category,
        features: product.features.join(' '),
        price: product.price,
        rating: product.rating,
        inStock: product.inStock,
        image: product.image,
        ...(product.embedding ? { embedding: product.embedding } : {}),
      },
    ]);

    const result = await this.client.bulk({ body, refresh: true });

    if (result.body.errors) {
      this.logger.error('Bulk indexing had errors');
    } else {
      this.logger.log(`Indexed ${products.length} products in OpenSearch`);
    }
  }

  async deleteIndex() {
    try {
      const exists = await this.client.indices.exists({ index: this.INDEX });
      if (exists.body) {
        await this.client.indices.delete({ index: this.INDEX });
      }
    } catch {
      this.logger.warn('Failed to delete OpenSearch index');
    }
  }
}
