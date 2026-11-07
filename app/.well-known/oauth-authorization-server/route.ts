import { mcpPreflight } from "@/lib/mcp/http";
import { authorizationServerMetadata, metadataResponse } from "@/lib/mcp/oauth-metadata";

export const dynamic = "force-dynamic";

export async function GET() {
  return metadataResponse(authorizationServerMetadata());
}

export { mcpPreflight as OPTIONS };
