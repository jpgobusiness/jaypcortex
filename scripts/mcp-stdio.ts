/**
 * Proxy stdio → HTTP MCP (para Cursor Desktop / Claude Desktop).
 * Uso: MCP_URL=https://jaypcortex.vercel.app/api/mcp MCP_TOKEN=jpc_... npx tsx scripts/mcp-stdio.ts
 */
import { spawn } from "node:child_process";

const url = process.env.MCP_URL || "http://localhost:3000/api/mcp";
const token = process.env.MCP_TOKEN || "";
if (!token) {
  console.error("Defina MCP_TOKEN");
  process.exit(1);
}

const child = spawn(
  "npx",
  ["-y", "mcp-remote", url, "--header", `Authorization: Bearer ${token}`],
  { stdio: "inherit" }
);
child.on("exit", (code) => process.exit(code ?? 1));
