import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, Role } from "../prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { EmbeddingService } from "../search/embedding.service";
import { KnowledgeDocumentDto } from "./dto/knowledge-document.dto";

const CHUNK_SIZE = 1_200;
const CHUNK_OVERLAP = 180;
const MAX_SEARCH_CANDIDATES = 1_000;
const MAX_CITATIONS = 5;

interface RankableChunk {
  id: string;
  content: string;
  embedding: Prisma.JsonValue | null;
}

interface SearchableChunk extends RankableChunk {
  document: {
    id: string;
    title: string;
    sourceUrl: string;
    category: string;
  };
}

export interface KnowledgeCitation {
  id: string;
  title: string;
  sourceUrl: string;
  category: string;
  excerpt: string;
}

export interface KnowledgeSearchResult {
  citations: KnowledgeCitation[];
  context: string;
}

export interface RankedChunk<T> {
  item: T;
  score: number;
}

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingService,
  ) {}

  async listDocuments(ownerUserId: string): Promise<
    Array<{
      id: string;
      title: string;
      sourceUrl: string;
      category: string;
      updatedAt: Date;
    }>
  > {
    return this.prisma.knowledgeDocument.findMany({
      where: { ownerUserId },
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        category: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  }

  async createDocument(dto: KnowledgeDocumentDto, ownerUserId: string | null) {
    const chunks = chunkText(dto.content);
    const vectors = this.embeddings.isConfigured()
      ? await this.embeddings.generateEmbeddings(
          chunks.map((chunk) => `${dto.title}. ${chunk}`),
        )
      : [];

    return this.prisma.knowledgeDocument.create({
      data: {
        title: dto.title,
        sourceUrl: validateSourceUrl(dto.sourceUrl),
        category: dto.category,
        content: dto.content,
        ownerUserId,
        chunks: {
          create: chunks.map((content, ordinal) => ({
            content,
            ordinal,
            ...(vectors[ordinal] ? { embedding: vectors[ordinal] } : {}),
          })),
        },
      },
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        category: true,
        updatedAt: true,
        _count: { select: { chunks: true } },
      },
    });
  }

  async updateDocument(
    id: string,
    dto: KnowledgeDocumentDto,
    ownerUserId: string,
  ) {
    await this.assertOwnedDocument(id, ownerUserId);
    const chunks = chunkText(dto.content);
    const vectors = this.embeddings.isConfigured()
      ? await this.embeddings.generateEmbeddings(
          chunks.map((chunk) => `${dto.title}. ${chunk}`),
        )
      : [];

    return this.prisma.$transaction(async (tx) => {
      await tx.knowledgeChunk.deleteMany({ where: { documentId: id } });
      return tx.knowledgeDocument.update({
        where: { id },
        data: {
          title: dto.title,
          sourceUrl: validateSourceUrl(dto.sourceUrl),
          category: dto.category,
          content: dto.content,
          chunks: {
            create: chunks.map((content, ordinal) => ({
              content,
              ordinal,
              ...(vectors[ordinal] ? { embedding: vectors[ordinal] } : {}),
            })),
          },
        },
        select: {
          id: true,
          title: true,
          sourceUrl: true,
          category: true,
          updatedAt: true,
          _count: { select: { chunks: true } },
        },
      });
    });
  }

  async deleteDocument(id: string, ownerUserId: string): Promise<void> {
    await this.assertOwnedDocument(id, ownerUserId);
    await this.prisma.knowledgeDocument.delete({ where: { id } });
  }

  async updateSharedDocument(id: string, dto: KnowledgeDocumentDto) {
    await this.assertSharedDocument(id);
    const chunks = chunkText(dto.content);
    const vectors = this.embeddings.isConfigured()
      ? await this.embeddings.generateEmbeddings(
          chunks.map((chunk) => `${dto.title}. ${chunk}`),
        )
      : [];
    return this.prisma.$transaction(async (tx) => {
      await tx.knowledgeChunk.deleteMany({ where: { documentId: id } });
      return tx.knowledgeDocument.update({
        where: { id },
        data: {
          title: dto.title,
          sourceUrl: validateSourceUrl(dto.sourceUrl),
          category: dto.category,
          content: dto.content,
          chunks: {
            create: chunks.map((content, ordinal) => ({
              content,
              ordinal,
              ...(vectors[ordinal] ? { embedding: vectors[ordinal] } : {}),
            })),
          },
        },
        select: {
          id: true,
          title: true,
          sourceUrl: true,
          category: true,
          updatedAt: true,
          _count: { select: { chunks: true } },
        },
      });
    });
  }

  async deleteSharedDocument(id: string): Promise<void> {
    await this.assertSharedDocument(id);
    await this.prisma.knowledgeDocument.delete({ where: { id } });
  }

  async search(
    query: string,
    user?: { id: string; role: Role },
  ): Promise<KnowledgeSearchResult> {
    const normalizedQuery = query.trim().slice(0, 1_000);
    if (!normalizedQuery) return { citations: [], context: "" };
    const embedding = this.embeddings.isConfigured()
      ? await this.embeddings.generateEmbedding(normalizedQuery)
      : undefined;

    const chunks = await this.prisma.knowledgeChunk.findMany({
      where: {
        document: {
          is:
            user?.role === Role.SELLER
              ? { OR: [{ ownerUserId: null }, { ownerUserId: user.id }] }
              : { ownerUserId: null },
        },
      },
      select: {
        id: true,
        content: true,
        embedding: true,
        document: {
          select: {
            id: true,
            title: true,
            sourceUrl: true,
            category: true,
          },
        },
      },
      take: MAX_SEARCH_CANDIDATES,
    });

    const ranked = rankKnowledgeChunks(
      normalizedQuery,
      chunks,
      embedding,
      MAX_CITATIONS,
    );
    const citations: KnowledgeCitation[] = ranked.map(({ item }, index) => ({
      id: String(index + 1),
      title: item.document.title,
      sourceUrl: item.document.sourceUrl,
      category: item.document.category,
      excerpt: item.content,
    }));

    const context = citations
      .map(
        (citation) =>
          `[${citation.id}] ${citation.title} (${citation.sourceUrl})\n${citation.excerpt}`,
      )
      .join("\n\n");

    return { citations, context };
  }

  async listPublicDocuments() {
    return this.prisma.knowledgeDocument.findMany({
      where: { ownerUserId: null },
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        category: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  }

  async getPublicDocument(id: string) {
    const document = await this.prisma.knowledgeDocument.findFirst({
      where: { id, ownerUserId: null },
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        category: true,
        content: true,
      },
    });
    if (!document) throw new NotFoundException("Knowledge document not found");
    return document;
  }

  private async assertOwnedDocument(
    id: string,
    ownerUserId: string,
  ): Promise<void> {
    const document = await this.prisma.knowledgeDocument.findUnique({
      where: { id },
      select: { ownerUserId: true },
    });
    if (!document) throw new NotFoundException("Knowledge document not found");
    if (document.ownerUserId !== ownerUserId) {
      throw new ForbiddenException("You can only manage your own documents");
    }
  }

  private async assertSharedDocument(id: string): Promise<void> {
    const document = await this.prisma.knowledgeDocument.findUnique({
      where: { id },
      select: { ownerUserId: true },
    });
    if (!document) throw new NotFoundException("Knowledge document not found");
    if (document.ownerUserId !== null) {
      throw new NotFoundException("Shared knowledge document not found");
    }
  }
}

export function chunkText(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(start + CHUNK_SIZE, normalized.length);
    if (end < normalized.length) {
      const boundary = normalized.lastIndexOf(" ", end);
      if (boundary > start + CHUNK_SIZE * 0.65) end = boundary;
    }
    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= normalized.length) break;
    start = Math.max(start + 1, end - CHUNK_OVERLAP);
  }
  return chunks;
}

export function rankKnowledgeChunks<T extends RankableChunk>(
  query: string,
  chunks: T[],
  queryEmbedding: number[] | undefined,
  limit: number,
): RankedChunk<T>[] {
  const terms = tokenize(query);
  if (!terms.length) return [];

  return chunks
    .map((item) => {
      const contentTerms = new Set(tokenize(item.content));
      const lexical =
        terms.filter((term) => contentTerms.has(term)).length / terms.length;
      const storedEmbedding = parseEmbedding(item.embedding);
      const cosine =
        queryEmbedding && storedEmbedding
          ? cosineSimilarity(queryEmbedding, storedEmbedding)
          : undefined;
      const semantic = cosine !== undefined ? (cosine + 1) / 2 : 0;
      const score = queryEmbedding ? lexical * 0.45 + semantic * 0.55 : lexical;
      return { item, score, lexical, cosine };
    })
    .filter(
      ({ lexical, cosine }) =>
        lexical > 0 || (cosine !== undefined && cosine >= 0.3),
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item, score }) => ({ item, score }));
}

function tokenize(value: string): string[] {
  const stopWords = new Set([
    "a",
    "an",
    "and",
    "are",
    "can",
    "do",
    "for",
    "how",
    "i",
    "is",
    "it",
    "me",
    "my",
    "of",
    "on",
    "or",
    "should",
    "the",
    "to",
    "was",
    "what",
    "when",
    "where",
    "with",
  ]);
  return (value.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? []).filter(
    (term) => !stopWords.has(term),
  );
}

function parseEmbedding(value: Prisma.JsonValue | null): number[] | undefined {
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "number")
  ) {
    return undefined;
  }
  return value as number[];
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    magnitudeA += a[index] ** 2;
    magnitudeB += b[index] ** 2;
  }
  if (!magnitudeA || !magnitudeB) return 0;
  return dot / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

function validateSourceUrl(sourceUrl: string): string {
  const url = new URL(sourceUrl);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username.length > 0 ||
    url.password.length > 0
  ) {
    throw new Error("Source URL must be a public HTTP(S) URL");
  }
  return url.toString();
}
