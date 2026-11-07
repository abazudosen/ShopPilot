import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { createHash, timingSafeEqual } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { Role } from "../prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { KnowledgeDocumentDto } from "./dto/knowledge-document.dto";
import { KnowledgeService } from "./knowledge.service";

@Controller("knowledge")
export class KnowledgeController {
  constructor(
    private readonly knowledgeService: KnowledgeService,
    private readonly configService: ConfigService,
  ) {}

  @Get("documents/public")
  listPublicDocuments() {
    return this.knowledgeService.listPublicDocuments();
  }

  @Get("documents/public/:id")
  getPublicDocument(@Param("id") id: string) {
    return this.knowledgeService.getPublicDocument(id);
  }

  @Get("seller/documents")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER)
  listSellerDocuments(@CurrentUser("id") userId: string) {
    return this.knowledgeService.listDocuments(userId);
  }

  @Post("seller/documents")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER)
  createSellerDocument(
    @Body() dto: KnowledgeDocumentDto,
    @CurrentUser("id") userId: string,
  ) {
    return this.knowledgeService.createDocument(dto, userId);
  }

  @Patch("seller/documents/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER)
  updateSellerDocument(
    @Param("id") id: string,
    @Body() dto: KnowledgeDocumentDto,
    @CurrentUser("id") userId: string,
  ) {
    return this.knowledgeService.updateDocument(id, dto, userId);
  }

  @Delete("seller/documents/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER)
  async deleteSellerDocument(
    @Param("id") id: string,
    @CurrentUser("id") userId: string,
  ) {
    await this.knowledgeService.deleteDocument(id, userId);
    return { deleted: true };
  }

  @Post("admin/documents")
  createSharedDocument(
    @Body() dto: KnowledgeDocumentDto,
    @Headers("x-knowledge-ingestion-token") token?: string,
  ) {
    this.assertAdminToken(token);
    return this.knowledgeService.createDocument(dto, null);
  }

  @Patch("admin/documents/:id")
  updateSharedDocument(
    @Param("id") id: string,
    @Body() dto: KnowledgeDocumentDto,
    @Headers("x-knowledge-ingestion-token") token?: string,
  ) {
    this.assertAdminToken(token);
    return this.knowledgeService.updateSharedDocument(id, dto);
  }

  @Delete("admin/documents/:id")
  async deleteSharedDocument(
    @Param("id") id: string,
    @Headers("x-knowledge-ingestion-token") token?: string,
  ) {
    this.assertAdminToken(token);
    await this.knowledgeService.deleteSharedDocument(id);
    return { deleted: true };
  }

  private assertAdminToken(token?: string): void {
    const expected = this.configService
      .get<string>("KNOWLEDGE_INGESTION_TOKEN")
      ?.trim();
    if (!expected || !token || !constantTimeEqual(token, expected)) {
      throw new UnauthorizedException("Invalid knowledge ingestion token");
    }
  }
}

function constantTimeEqual(candidate: string, expected: string): boolean {
  const candidateHash = createHash("sha256").update(candidate).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(candidateHash, expectedHash);
}
