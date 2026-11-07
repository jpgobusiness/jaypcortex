import type { EditorDocument } from "@/lib/types";
import { collectSections } from "@/lib/knowledge/tiptap-text";

const TARGET_TOKENS = 700;
const OVERLAP_TOKENS = 80;

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export type KnowledgeChunkInput = {
  chunkIndex: number;
  headingPath: string;
  content: string;
  tokenCount: number;
};

export function chunkDocument(title: string, doc: EditorDocument | null): KnowledgeChunkInput[] {
  const sections = collectSections(doc ?? { type: "doc" });
  const pieces: { headingPath: string; text: string }[] = [];
  for (const section of sections) {
    const headingPath = section.headingPath;
    const words = section.text.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;
    const maxWords = TARGET_TOKENS * 3;
    for (let i = 0; i < words.length; i += maxWords - OVERLAP_TOKENS) {
      const slice = words.slice(i, i + maxWords).join(" ");
      pieces.push({ headingPath, text: slice });
    }
  }
  return pieces.map((piece, chunkIndex) => {
    const prefix = [title, piece.headingPath].filter(Boolean).join(" > ");
    const content = prefix ? `${prefix}\n\n${piece.text}` : piece.text;
    return {
      chunkIndex,
      headingPath: piece.headingPath,
      content,
      tokenCount: estimateTokens(content),
    };
  });
}
