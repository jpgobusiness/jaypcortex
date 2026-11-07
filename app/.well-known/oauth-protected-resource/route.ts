import { mcpPreflight } from "@/lib/mcp/http";
import { metadataResponse, protectedResourceMetadata } from "@/lib/mcp/oauth-metadata";

export const dynamic = "force-dynamic";

export async function GET() {
  return metadataResponse(protectedResourceMetadata());
}

export { mcpPreflight as OPTIONS };
