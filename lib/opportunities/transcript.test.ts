import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { test } from "node:test";
import {
  parseTranscriptFile,
  splitTranscriptParts,
  transcriptPartTitles,
  unzipFile,
} from "./transcript";

const VTT = `WEBVTT

NOTE comentário interno

1
00:00:00.000 --> 00:00:02.500
<v João>Olá pessoal

00:00:02.500 --> 00:00:05.000
Maria: seguimos com o MAP
`;

const SRT = `1
00:00:00,000 --> 00:00:02,000
Fulano: texto um

2
00:00:02,000 --> 00:00:04,000
Ciclano: texto dois
`;

test("VTT remove timestamps e mantém falante", () => {
  const text = parseTranscriptFile({ name: "reuniao.vtt", text: VTT });
  assert.equal(text.includes("00:00"), false);
  assert.match(text, /João: Olá pessoal/);
  assert.match(text, /Maria: seguimos com o MAP/);
  assert.doesNotMatch(text, /NOTE/);
});

test("SRT remove timestamps e mantém falante", () => {
  const text = parseTranscriptFile({ name: "call.srt", text: SRT });
  assert.equal(text.includes("-->"), false);
  assert.match(text, /Fulano: texto um/);
  assert.match(text, /Ciclano: texto dois/);
});

test("txt/md passa limpo", () => {
  const text = parseTranscriptFile({ name: "notas.md", text: "# Kickoff\n\nJoão: ok\n" });
  assert.match(text, /João: ok/);
});

test("divide acima do limite em partes nomeadas", () => {
  const parts = splitTranscriptParts("aaa\n\nbbb\n\nccc", 8);
  assert.ok(parts.length >= 2);
  assert.ok(parts.every((p) => Buffer.byteLength(p, "utf8") <= 8));
  const titles = transcriptPartTitles("Transcrição 2026-11-09", parts.length);
  assert.equal(titles[0], "Transcrição 2026-11-09 (parte 1)");
  assert.equal(titles.at(-1), `Transcrição 2026-11-09 (parte ${parts.length})`);
});

test("abaixo do limite não divide", () => {
  const parts = splitTranscriptParts("curto", 100);
  assert.deepEqual(parts, ["curto"]);
  assert.deepEqual(transcriptPartTitles("Transcrição 2026-11-09", 1), ["Transcrição 2026-11-09"]);
});

function zipStore(name: string, data: Buffer) {
  const nameBuf = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 8);
  local.writeUInt32LE(0, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  const compressed = deflateRawSync(data);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(compressed.length, 18);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBuf.length, 28);
  central.writeUInt32LE(0, 42);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(46 + nameBuf.length, 12);
  eocd.writeUInt32LE(30 + nameBuf.length + compressed.length, 16);
  return Buffer.concat([local, nameBuf, compressed, central, nameBuf, eocd]);
}

test("docx extrai texto de word/document.xml", () => {
  const xml = Buffer.from(
    `<?xml version="1.0"?><w:document><w:body><w:p><w:r><w:t>Ana: kickoff</w:t></w:r></w:p><w:p><w:r><w:t>ok</w:t></w:r></w:p></w:body></w:document>`
  );
  const zip = zipStore("word/document.xml", xml);
  const extracted = unzipFile(zip, "word/document.xml");
  assert.ok(extracted);
  const text = parseTranscriptFile({ name: "notas.docx", bytes: zip });
  assert.match(text, /Ana: kickoff/);
  assert.match(text, /ok/);
});
