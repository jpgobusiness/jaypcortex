import type { ToolServer } from "@/lib/mcp/annotations";
import { bindWorkspaceTools, type WorkspaceToolApi } from "@/lib/mcp/workspace-tools";
import { parseBulkTree } from "@/lib/workspaces/tree-logic";
import {
  archiveWorkspace,
  createFile,
  createFolder,
  createStructureBulk,
  createWorkspace,
  deleteFile,
  deleteFolder,
  getFileChildren,
  getWorkspaceTree,
  linkKnowledgeTree,
  listFiles,
  listWorkspaces,
  moveFile,
  moveFolder,
  updateFile,
  updateFolder,
  updateWorkspace,
} from "@/lib/workspaces/tree";

export function registerWorkspaceTools(
  server: ToolServer,
  ctx: { tokenId: string; profileId: string; scopes: string[] }
) {
  const actor = { createdBy: ctx.profileId || null, source: "mcp" as const, tokenId: ctx.tokenId };
  const api: WorkspaceToolApi = {
    list: (opts) => listWorkspaces(opts),
    createWorkspace: (input) => createWorkspace(input, actor),
    updateWorkspace: (token, patch) => updateWorkspace(token, patch, actor),
    archive: (token) => archiveWorkspace(token, actor),
    tree: (token) => getWorkspaceTree(token),
    createFolder: (input) => createFolder(input, actor),
    updateFolder: (token, name) => updateFolder({ id: token, path: token }, name, actor),
    moveFolder: (token, target) => moveFolder({ id: token, path: token }, target, actor),
    deleteFolder: (token) => deleteFolder({ id: token, path: token }, actor),
    createFile: (input) => createFile(input, actor),
    updateFile: (token, patch) => updateFile({ id: token, path: token }, patch, actor),
    moveFile: (token, target) => moveFile({ id: token, path: token }, target, actor),
    deleteFile: (token) => deleteFile({ id: token, path: token }, actor),
    listFiles: (opts) => listFiles(opts),
    children: (token) => getFileChildren(token),
    bulk: (tree) => createStructureBulk(parseBulkTree(tree), actor),
    link: (agent, target) => linkKnowledgeTree(agent, target),
  };
  bindWorkspaceTools(server, ctx, api);
}
