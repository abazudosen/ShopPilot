import { Module, Global } from "@nestjs/common";
import { SearchService } from "./search.service";
import { EmbeddingService } from "./embedding.service";
import { AiProviderModule } from "../ai/ai-provider.module";

@Global()
@Module({
  imports: [AiProviderModule],
  providers: [SearchService, EmbeddingService],
  exports: [SearchService, EmbeddingService],
})
export class SearchModule {}
