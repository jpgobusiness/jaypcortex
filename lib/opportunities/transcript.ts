import { inflateRawSync } from "node:zlib";

export const TRANSCRIPT_MAX_BYTES = 5 * 1024 * 1024;

const TIMESTAMP = /^\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3}\s+-->\s+\d{1,2}:\d{2}/;
const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;

export type TranscriptInput = {
  name?: string;
  mime?: string;
  text?: string;
  bytes?: Uint8Array;
};

function utf8Bytes(value: string) {
  return Buffer.byteLength(value, "utf8");
}

function extOf(name?: string) {
  const base = (name ?? "").split(/[/?#]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot + 1).toLowerCase() : "";
}

function decodeText(input: TranscriptInput) {
  if (typeof input.text === "string") return input.text;
  if (input.bytes) return new TextDecoder("utf-8", { fatal: false }).decode(input.bytes);
  return "";
}

function u16(buf: Buffer, offset: number) {
  return buf.readUInt16LE(offset);
}

function u32(buf: Buffer, offset: number) {
  return buf.readUInt32LE(offset);
}

/** Extrai um arquivo de um ZIP (STORE ou DEFLATE). Usado só para DOCX. */
export function unzipFile(buf: Buffer, name: string): Buffer | null {
  let eocd = -1;
  const min = Math.max(0, buf.length - 22 - 65535);
  for (let i = buf.length - 22; i >= min; i--) {
    if (u32(buf, i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const cdOffset = u32(buf, eocd + 16);
  const cdSize = u32(buf, eocd + 12);
  let offset = cdOffset;
  const end = cdOffset + cdSize;
  while (offset + 46 <= end) {
    if (u32(buf, offset) !== CENTRAL_SIG) break;
    const method = u16(buf, offset + 10);
    const compSize = u32(buf, offset + 20);
    const nameLen = u16(buf, offset + 28);
    const extraLen = u16(buf, offset + 30);
    const commentLen = u16(buf, offset + 32);
    const localOff = u32(buf, offset + 42);
    const entryName = buf.subarray(offset + 46, offset + 46 + nameLen).toString("utf8");
    offset += 46 + nameLen + extraLen + commentLen;
    if (entryName !== name) continue;
    if (u32(buf, localOff) !== LOCAL_SIG) return null;
    const localNameLen = u16(buf, localOff + 26);
    const localExtraLen = u16(buf, localOff + 28);
    const dataStart = localOff + 30 + localNameLen + localExtraLen;
    const compressed = buf.subarray(dataStart, dataStart + compSize);
    if (method === 0) return Buffer.from(compressed);
    if (method === 8) return inflateRawSync(compressed);
    return null;
  }
  return null;
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export function docxToText(bytes: Uint8Array): string {
  const xml = unzipFile(Buffer.from(bytes), "word/document.xml");
  if (!xml) throw new Error("DOCX inválido");
  return xml
    .toString("utf8")
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br\s*\/>/g, "\n")
    .split(/<\/w:p>/)
    .map((block) => {
      const texts = [...block.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => decodeXmlEntities(m[1]));
      return texts.join("").replace(/\s+/g, " ").trim();
    })
    .filter(Boolean)
    .join("\n");
}

function cueLine(raw: string) {
  let line = raw
    .replace(/<v\s+([^>]+)>/gi, "$1: ")
    .replace(/<\/v>/gi, "")
    .replace(/<\/?c[^>]*>/gi, "")
    .replace(/<\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}>/g, "")
    .replace(/<[^>]+>/g, "");
  return decodeXmlEntities(line).replace(/\s+/g, " ").trim();
}

function parseCueFile(raw: string, kind: "vtt" | "srt") {
  const lines = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  if (kind === "vtt" && (lines[0] ?? "").trim().startsWith("WEBVTT")) {
    i = 1;
    while (i < lines.length && lines[i].trim() !== "") i += 1;
    if (i < lines.length) i += 1;
  }
  const out: string[] = [];
  let skipUntilBlank = false;
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (skipUntilBlank) {
      if (!trimmed) skipUntilBlank = false;
      i += 1;
      continue;
    }
    if (kind === "vtt" && /^(NOTE|STYLE|REGION)(\s|$)/.test(trimmed)) {
      skipUntilBlank = true;
      i += 1;
      continue;
    }
    if (!trimmed) {
      i += 1;
      continue;
    }
    if (TIMESTAMP.test(trimmed)) {
      i += 1;
      continue;
    }
    const next = (lines[i + 1] ?? "").trim();
    if (TIMESTAMP.test(next)) {
      i += 1;
      continue;
    }
    const text = cueLine(lines[i]);
    if (text) out.push(text);
    i += 1;
  }
  return out.join("\n");
}

function looksLikeSrt(raw: string) {
  return /^\s*\d+\s*\n\d{2}:\d{2}:\d{2},\d{3}\s+-->/m.test(raw);
}

export function cleanTranscriptText(raw: string) {
  return raw
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseTranscriptFile(input: TranscriptInput): string {
  const ext = extOf(input.name);
  const mime = (input.mime ?? "").toLowerCase();
  if (ext === "docx" || mime.includes("wordprocessingml")) {
    if (!input.bytes) throw new Error("DOCX exige o arquivo original");
    return cleanTranscriptText(docxToText(input.bytes));
  }
  const raw = decodeText(input);
  if (ext === "vtt" || mime.includes("vtt") || raw.trimStart().startsWith("WEBVTT")) {
    return cleanTranscriptText(parseCueFile(raw, "vtt"));
  }
  if (ext === "srt" || looksLikeSrt(raw)) {
    return cleanTranscriptText(parseCueFile(raw, "srt"));
  }
  return cleanTranscriptText(raw);
}

function splitOversized(value: string, maxBytes: number): string[] {
  if (utf8Bytes(value) <= maxBytes) return [value];
  const chars = Array.from(value);
  const parts: string[] = [];
  let current = "";
  for (const ch of chars) {
    const next = current + ch;
    if (utf8Bytes(next) > maxBytes) {
      if (current) parts.push(current);
      current = ch;
    } else {
      current = next;
    }
  }
  if (current) parts.push(current);
  return parts.length ? parts : [value];
}

/** Divide texto em partes de no máximo `maxBytes` (UTF-8), preferindo parágrafos. */
export function splitTranscriptParts(text: string, maxBytes = TRANSCRIPT_MAX_BYTES): string[] {
  const cleaned = cleanTranscriptText(text);
  if (!cleaned) return [""];
  if (utf8Bytes(cleaned) <= maxBytes) return [cleaned];
  const parts: string[] = [];
  let buffer = "";
  const flush = () => {
    if (buffer) {
      parts.push(buffer);
      buffer = "";
    }
  };
  const join = (left: string, right: string) => (left ? `${left}\n\n${right}` : right);
  for (const para of cleaned.split(/\n{2,}/)) {
    for (const piece of splitOversized(para, maxBytes)) {
      const candidate = join(buffer, piece);
      if (buffer && utf8Bytes(candidate) > maxBytes) {
        flush();
        buffer = piece;
      } else {
        buffer = candidate;
      }
    }
  }
  flush();
  return parts.length ? parts : [cleaned];
}

export function transcriptPartTitles(baseTitle: string, partCount: number) {
  const base = baseTitle.trim() || "Transcrição";
  if (partCount <= 1) return [base];
  return Array.from({ length: partCount }, (_, i) => `${base} (parte ${i + 1})`);
}
