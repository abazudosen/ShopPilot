import { Injectable } from "@nestjs/common";
import { AiProviderService } from "../ai/ai-provider.service";

@Injectable()
export class EmbeddingService {
  constructor(private readonly aiProvider: AiProviderService) {}

  isConfigured(): boolean {
    return this.aiProvider.isConfigured();
  }

  async generateEmbedding(text: string): Promise<number[]> {
    return this.aiProvider.generateEmbedding(text);
  }

  buildEmbeddingText(product: {
    name: string;
    description: string;
    category: string;
    features: string[];
  }): string {
    return `${product.name}. ${product.description}. Category: ${product.category}. Features: ${product.features.join(", ")}`;
  }
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    return this.aiProvider.generateEmbeddings(texts);
  }
}
