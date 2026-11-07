import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chunkText, rankKnowledgeChunks } from "./knowledge.service";

interface EvaluationCase {
  query: string;
  expectedDocumentId: string;
  expectedAnswer: string;
  documents: Array<{ id: string; text: string }>;
}

describe("knowledge retrieval evaluation", () => {
  const cases = JSON.parse(
    readFileSync(join(__dirname, "../../evals/rag-evaluation.json"), "utf8"),
  ) as EvaluationCase[];

  it.each(cases)('ranks the expected source for "$query"', (evaluation) => {
    const chunks = evaluation.documents.map((document) => ({
      id: document.id,
      content: document.text,
      embedding: null,
    }));

    const [topHit] = rankKnowledgeChunks(
      evaluation.query,
      chunks,
      undefined,
      3,
    );

    expect(topHit?.item.id).toBe(evaluation.expectedDocumentId);
  });

  it.each(cases)('grounds the reference answer for "$query"', (evaluation) => {
    const source = evaluation.documents.find(
      (document) => document.id === evaluation.expectedDocumentId,
    );

    expect(source).toBeDefined();
    expect(source?.text).toContain(evaluation.expectedAnswer);
  });

  it("chunks long sources with bounded size and overlap", () => {
    const source = `${"First section. ".repeat(120)}${"Second section. ".repeat(120)}`;
    const chunks = chunkText(source);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 1_200)).toBe(true);
    expect(chunks[0].slice(-180).trimStart().slice(0, 100)).toEqual(
      chunks[1].slice(0, 100),
    );
  });

  it("includes semantic matches when keyword overlap is absent", () => {
    const chunks = [
      {
        id: "semantic",
        content: "A different wording",
        embedding: [1, 0],
      },
    ];

    const [topHit] = rankKnowledgeChunks(
      "query without matching words",
      chunks,
      [1, 0],
      1,
    );

    expect(topHit?.item.id).toBe("semantic");
  });
});
