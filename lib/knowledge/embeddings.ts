export type EmbeddingsProvider = {
  name: string;
  dimensions: number;
  embed(texts: string[]): Promise<number[][] | null>;
};

async function openaiEmbed(texts: string[]): Promise<number[][] | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  if (texts.length === 0) return [];
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: texts,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenAI embeddings ${res.status}: ${detail.slice(0, 200)}`);
  }
  const body = (await res.json()) as { data: { embedding: number[]; index: number }[] };
  return body.data.sort((a, b) => a.index - b.index).map((row) => row.embedding);
}

export const embeddings: EmbeddingsProvider = {
  name: process.env.EMBEDDINGS_PROVIDER || "openai",
  dimensions: 1536,
  embed: openaiEmbed,
};

export function toVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}
