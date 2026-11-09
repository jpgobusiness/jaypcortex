"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Layers,
  Plus,
} from "lucide-react";
import { useWorkspaces } from "@/components/workspaces/WorkspacesProvider";
import WorkspaceBadge from "@/components/workspaces/WorkspaceBadge";
import { officeHref } from "@/lib/agents";
import { TEMPLATES_FOLDER } from "@/lib/opportunities/constants";
import { fileHref, folderHref, isAgentRoom, workspaceHref } from "@/lib/workspaces";
import type {
  WorkspaceFileSummary,
  WorkspaceFolder,
  WorkspaceTree,
} from "@/lib/types";

const ICON = "h-[18px] w-[18px] shrink-0";

function rowTone(active: boolean) {
  return active
    ? "bg-[var(--sidebar-active)] text-white"
    : "text-white/90 hover:bg-[var(--sidebar-hover)] hover:text-white";
}

/** Recuo de cada nível da árvore: espaço → pasta → arquivo. */
function indent(depth: number) {
  return { paddingLeft: 12 + depth * 14 };
}

/** Lê o espaço, a pasta e o arquivo abertos a partir da URL. */
function activeIds(pathname: string) {
  const file = /^\/espacos\/([^/]+)\/arquivos\/([^/]+)/.exec(pathname);
  if (file) return { workspaceId: file[1], fileId: file[2], folderId: null };
  const folder = /^\/espacos\/([^/]+)\/pastas\/([^/]+)/.exec(pathname);
  if (folder) return { workspaceId: folder[1], fileId: null, folderId: folder[2] };
  const workspace = /^\/espacos\/([^/]+)/.exec(pathname);
  return { workspaceId: workspace?.[1] ?? null, fileId: null, folderId: null };
}

function findFolderOfFile(workspaces: WorkspaceTree[], fileId: string | null) {
  if (!fileId) return null;
  for (const workspace of workspaces) {
    for (const folder of workspace.folders) {
      if (folder.files.some((file) => file.id === fileId)) return folder.id;
    }
  }
  return null;
}

type Props = {
  collapsed: boolean;
  onNavigate?: () => void;
};

/** Seção "Espaços de Trabalho" do menu: botão + e árvore de espaços. */
export default function SidebarWorkspaces({ collapsed, onNavigate }: Props) {
  const pathname = usePathname();
  const { workspaces, loading, error, openCreateWorkspace } = useWorkspaces();
  const [sectionOpen, setSectionOpen] = useState(true);
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const [lastPath, setLastPath] = useState(pathname);

  const {
    workspaceId: activeWorkspaceId,
    fileId: activeFileId,
    folderId: pathFolderId,
  } = activeIds(pathname);
  const activeFolderId = pathFolderId ?? findFolderOfFile(workspaces, activeFileId);
  const sectionActive = pathname.startsWith("/espacos") || pathname.startsWith("/escritorio");
  const spaces = workspaces.filter((workspace) => !isAgentRoom(workspace));
  const inRoom = workspaces.some(
    (workspace) => isAgentRoom(workspace) && workspace.id === activeWorkspaceId
  );
  const roomsActive = pathname.startsWith("/escritorio") || inRoom;

  // Ao navegar, volta a abrir o caminho até a página atual.
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setToggled((current) => {
      const next = { ...current };
      if (activeWorkspaceId) delete next[activeWorkspaceId];
      if (activeFolderId) delete next[activeFolderId];
      return next;
    });
  }

  function openByDefault(id: string) {
    return id === activeWorkspaceId || id === activeFolderId;
  }

  function isOpen(id: string) {
    return toggled[id] ?? openByDefault(id);
  }

  function toggle(id: string) {
    setToggled((current) => ({
      ...current,
      [id]: !(current[id] ?? openByDefault(id)),
    }));
  }

  if (collapsed) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setSectionOpen((value) => !value)}
          title="Espaços de Trabalho"
          className={`flex h-10 w-full items-center justify-center transition-colors ${rowTone(sectionActive)}`}
        >
          <Layers className={ICON} strokeWidth={1.75} />
        </button>
        {sectionOpen && (
          <>
            {spaces.map((workspace) => (
              <Link
                key={workspace.id}
                href={workspaceHref(workspace.id)}
                onClick={onNavigate}
                title={workspace.name}
                className={`flex h-10 w-full items-center justify-center transition-colors ${rowTone(
                  activeWorkspaceId === workspace.id
                )}`}
              >
                <WorkspaceBadge workspace={workspace} />
              </Link>
            ))}
            <Link
              href={officeHref()}
              onClick={onNavigate}
              title="Sala dos agentes"
              className={`flex h-10 w-full items-center justify-center transition-colors ${rowTone(roomsActive)}`}
            >
              <Bot className={ICON} strokeWidth={1.75} />
            </Link>
            <button
              type="button"
              onClick={openCreateWorkspace}
              title="Novo espaço"
              aria-label="Novo espaço"
              className={`flex h-10 w-full items-center justify-center transition-colors ${rowTone(false)}`}
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <div
        className={`flex h-10 w-full items-center text-[13px] transition-colors ${rowTone(sectionActive)}`}
      >
        <Link
          href="/espacos"
          onClick={onNavigate}
          className="flex h-10 min-w-0 flex-1 items-center gap-3 pl-4"
        >
          <Layers className={ICON} strokeWidth={1.75} />
          <span className="truncate">Espaços de Trabalho</span>
        </Link>
        <button
          type="button"
          onClick={openCreateWorkspace}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/85 hover:bg-white/15 hover:text-white"
          aria-label="Novo espaço"
          title="Novo espaço"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={() => setSectionOpen((value) => !value)}
          className="mr-1 inline-flex h-10 w-8 shrink-0 items-center justify-center text-white/80 hover:text-white"
          aria-label={
            sectionOpen ? "Recolher Espaços de Trabalho" : "Expandir Espaços de Trabalho"
          }
          aria-expanded={sectionOpen}
        >
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${sectionOpen ? "" : "-rotate-90"}`}
            strokeWidth={1.75}
          />
        </button>
      </div>

      {sectionOpen && (
        <div className="pb-1">
          {loading ? (
            <p className="px-4 py-2 text-[12px] text-white/70">Carregando...</p>
          ) : error ? (
            <p className="px-4 py-2 text-[12px] text-white/70">
              Não foi possível carregar os espaços.
            </p>
          ) : (
            <>
              {spaces.map((workspace) => (
                <SpaceNode
                  key={workspace.id}
                  workspace={workspace}
                  isOpen={isOpen}
                  onToggle={toggle}
                  activeWorkspaceId={activeWorkspaceId}
                  activeFileId={activeFileId}
                  activeFolderId={activeFolderId}
                  onNavigate={onNavigate}
                />
              ))}
              <Link
                href={officeHref()}
                onClick={onNavigate}
                className={`flex h-9 items-center gap-2 pr-2 text-[13px] transition-colors ${rowTone(roomsActive)}`}
                style={indent(0)}
              >
                <span className="-mr-1 w-5 shrink-0" aria-hidden />
                <Bot className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                <span className="min-w-0 flex-1 truncate">Sala dos agentes</span>
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

type TreeProps = {
  isOpen: (id: string) => boolean;
  onToggle: (id: string) => void;
  activeFileId: string | null;
  activeFolderId: string | null;
  onNavigate?: () => void;
};

function SpaceNode({
  workspace,
  activeWorkspaceId,
  depth = 0,
  ...tree
}: TreeProps & { workspace: WorkspaceTree; activeWorkspaceId: string | null; depth?: number }) {
  const open = tree.isOpen(workspace.id);
  const active =
    activeWorkspaceId === workspace.id && !tree.activeFileId && !tree.activeFolderId;
  const empty = workspace.folders.length === 0 && workspace.files.length === 0;

  return (
    <div>
      <div
        className={`flex h-9 items-center pr-2 text-[13px] transition-colors ${rowTone(active)}`}
        style={indent(depth)}
      >
        <TreeChevron
          open={open}
          label={workspace.name}
          onClick={() => tree.onToggle(workspace.id)}
        />
        <Link
          href={workspaceHref(workspace.id)}
          onClick={tree.onNavigate}
          title={workspace.name}
          className="flex h-9 min-w-0 flex-1 items-center gap-2"
        >
          <WorkspaceBadge workspace={workspace} />
          <span className="truncate">{workspace.name}</span>
        </Link>
      </div>
      {open && (
        <div>
          {workspace.folders
            .filter((folder) => folder.name !== TEMPLATES_FOLDER)
            .map((folder) => (
            <FolderNode key={folder.id} folder={folder} depth={depth + 1} {...tree} />
          ))}
          {workspace.files.map((file) => (
            <FileNode key={file.id} file={file} depth={depth + 1} {...tree} />
          ))}
          {empty && <EmptyRow depth={depth + 1}>Espaço vazio</EmptyRow>}
        </div>
      )}
    </div>
  );
}

function FolderNode({
  folder,
  depth,
  ...tree
}: TreeProps & { folder: WorkspaceFolder; depth: number }) {
  const open = tree.isOpen(folder.id);
  const active = tree.activeFolderId === folder.id && !tree.activeFileId;
  const Icon = open ? FolderOpen : Folder;

  return (
    <div>
      <div
        className={`flex h-8 items-center pr-2 text-[13px] transition-colors ${rowTone(active)}`}
        style={indent(depth)}
      >
        <TreeChevron
          open={open}
          label={folder.name}
          onClick={() => tree.onToggle(folder.id)}
        />
        <Link
          href={folderHref(folder.workspaceId, folder.id)}
          onClick={tree.onNavigate}
          title={folder.name}
          className="flex h-8 min-w-0 flex-1 items-center gap-2"
        >
          <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span className="min-w-0 flex-1 truncate">{folder.name}</span>
          <span className="shrink-0 text-[11px] text-white/60">
            {folder.files.length}
          </span>
        </Link>
      </div>
      {open &&
        (folder.files.length > 0 ? (
          folder.files.map((file) => (
            <FileNode key={file.id} file={file} depth={depth + 1} {...tree} />
          ))
        ) : (
          <EmptyRow depth={depth + 1}>Pasta vazia</EmptyRow>
        ))}
    </div>
  );
}

function FileNode({
  file,
  depth,
  activeFileId,
  onNavigate,
}: TreeProps & { file: WorkspaceFileSummary; depth: number }) {
  return (
    <Link
      href={fileHref(file.workspaceId, file.id)}
      onClick={onNavigate}
      title={file.title}
      className={`flex h-8 items-center gap-2 pr-2 text-[13px] transition-colors ${rowTone(
        activeFileId === file.id
      )}`}
      style={indent(depth)}
    >
      <span className="-mr-1 w-5 shrink-0" aria-hidden />
      <FileText className="h-4 w-4 shrink-0 opacity-85" strokeWidth={1.75} />
      <span className="truncate">{file.title}</span>
    </Link>
  );
}

function TreeChevron({
  open,
  label,
  onClick,
}: {
  open: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={open ? `Recolher ${label}` : `Expandir ${label}`}
      aria-expanded={open}
      className="mr-1 inline-flex h-6 w-5 shrink-0 items-center justify-center rounded text-white/70 hover:bg-white/15 hover:text-white"
    >
      <ChevronRight
        className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`}
      />
    </button>
  );
}

function EmptyRow({ depth, children }: { depth: number; children: React.ReactNode }) {
  return (
    <p
      className="flex h-8 items-center text-[12px] text-white/60"
      style={{ paddingLeft: indent(depth).paddingLeft + 24 }}
    >
      {children}
    </p>
  );
}
