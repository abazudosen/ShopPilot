import { IsIn, IsString, IsUrl, Length, MaxLength } from "class-validator";

export class KnowledgeDocumentDto {
  @IsString()
  @Length(1, 200)
  title: string;

  @IsUrl({ protocols: ["http", "https"], require_protocol: true })
  sourceUrl: string;

  @IsIn(["FAQ", "MANUAL", "POLICY", "SELLER_INFO"])
  category: string;

  @IsString()
  @Length(20, 100_000)
  @MaxLength(100_000)
  content: string;
}
