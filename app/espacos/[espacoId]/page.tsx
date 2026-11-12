"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Clock,
  FilePlus,
  FileText,
  Folder,
  FolderPlus,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/form";
import FolderDeliveries from "@/components/workspaces/FolderDeliveries";
import WorkspaceAttachments from "@/components/workspaces/WorkspaceAttachments";
import {
  HeaderSubtitleInput,
  HeaderTitleInput,
} from "@/components/workspaces/IdentityInputs";
import KindBadge from "@/components/workspaces/KindBadge";
import NameModal from "@/components/workspaces/NameModal";
import OpportunityChip from "@/components/workspaces/OpportunityChip";
import OpportunityFolderModal from "@/components/workspaces/OpportunityFolderModal";
import WorkspaceCrumbs from "@/components/workspaces/WorkspaceCrumbs";
import WorkspaceFileList, {
  IconButton,
} from "@/components/workspaces/WorkspaceFileList";
import WorkspaceFormModal from "@/components/workspaces/WorkspaceFormModal";
import WorkspaceStatCard from "@/components/workspaces/WorkspaceStatCard";
import { useWorkspaces } from "@/components/workspaces/WorkspacesProvider";
import { apiDelete, apiGet, apiPatch, apiPost, apiPostForm } from "@/lib/fetcher";
import { transcriptTitle } from "@/lib/opportunities/format";
import { OPPORTUNITIES_KEY, TEMPLATES_FOLDER } from "@/lib/opportunities/constants";
import {
  countLabel,
  fileHref,
  folderHref,
  formatDateTime,
  lastWorkspaceUpdate,
  workspaceFiles,
} from "@/lib/workspaces";
import type { FunnelOpportunityChip, WorkspaceFileSummary, WorkspaceFolder } from "@/lib/types";

type FolderModal = { mode: "create" } | { mode: "rename"; folder: WorkspaceFolder };

const RECENT_LIMIT = 4;

export default function EspacoDashboardPage() {
  const { espacoId } = useParams<{ espacoId: string }>();
  const router = useRouter();
  const { workspaces, loading, reload } = useWorkspaces();
  const workspace = workspaces.find((item) => item.id === espacoId) ?? null;

  const [query, setQuery] = useState("");
  const [folderModal, setFolderModal] = useState<FolderModal | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [creatingFile, setCreatingFile] = useState(false);
  const [opportunityOpen, setOpportunityOpen] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [funnel, setFunnel] = useState<FunnelOpportunityChip[]>([]);

  // Atualiza o dashboard sempre que o espaço abre (prévias e datas dos arquivos).
  useEffect(() => {
    void reload();
  }, [reload, espacoId]);

  const closeFolderModal = useCallback(() => setFolderModal(null), []);
  const closeEdit = useCallback(() => setEditOpen(false), []);
  const closeOpportunity = useCallback(() => setOpportunityOpen(false), []);
  const isOpportunities = workspace?.key === OPPORTUNITIES_KEY;

  useEffect(() => {
    if (!isOpportunities) return;
    apiGet<FunnelOpportunityChip[]>("/api/opportunities")
      .then(setFunnel)
      .catch(() => setFunnel([]));
  }, [isOpportunities, espacoId]);

  const files = useMemo(
    () => (workspace ? workspaceFiles(workspace) : []),
    [workspace]
  );
  const folderNames = useMemo(
    () => new Map(workspace?.folders.map((folder) => [folder.id, folder.name])),
    [workspace]
  );

  if (!workspace) {
    return loading ? (
      <p className="py-10 text-center text-[var(--muted)]">Carregando...</p>
    ) : (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-base font-semibold text-[var(--foreground)]">
          Espaço não encontrado
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Ele pode ter sido excluído.
        </p>
        <Link
          href="/espacos"
          className="mt-4 inline-flex text-sm font-medium text-[var(--brand-600)] hover:underline"
        >
          Ver todos os espaços
        </Link>
      </div>
    );
  }

  const current = workspace;
  const visibleFolders = current.folders.filter(
    (folder) => showTemplates || folder.name !== TEMPLATES_FOLDER
  );
  const templateFolder = current.folders.find((folder) => folder.name === TEMPLATES_FOLDER);
  const recent = [...files]
    .filter((file) => showTemplates || folderNames.get(file.folderId ?? "") !== TEMPLATES_FOLDER)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, RECENT_LIMIT);
  const term = query.trim().toLowerCase();
  const results = term
    ? files.filter(
        (file) =>
          file.title.toLowerCase().includes(term) ||
          file.excerpt.toLowerCase().includes(term)
      )
    : [];
  const empty = visibleFolders.length === 0 && current.files.length === 0 && !templateFolder;

  async function createFile(folderId: string | null) {
    if (creatingFile) return;
    setCreatingFile(true);
    try {
      const file = await apiPost<WorkspaceFileSummary>("/api/workspaces/files", {
        workspaceId: current.id,
        folderId,
      });
      await reload();
      router.push(fileHref(current.id, file.id, { editar: true }));
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "Erro ao criar o arquivo");
      setCreatingFile(false);
    }
  }

  async function createOpportunityFolder(name: string, opportunityId?: string) {
    await apiPost("/api/opportunities/folders", {
      name,
      opportunity_id: opportunityId,
    });
    await reload();
  }

  async function importTranscriptFile(folderId: string, file: File) {
    if (creatingFile) return;
    setCreatingFile(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await apiPostForm<{
        files: { file_id: string }[];
        parts: number;
        split?: boolean;
        warning?: string;
      }>(`/api/workspaces/folders/${folderId}/transcripts`, form);
      await reload();
      if (result.warning) alert(result.warning);
      else if (result.split && result.parts > 1) {
        alert(`Transcrição dividida em ${result.parts} partes (acima de 5 MB).`);
      }
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "Erro ao importar a transcrição");
    } finally {
      setCreatingFile(false);
    }
  }

  async function createTranscript(folderId: string) {
    if (creatingFile) return;
    setCreatingFile(true);
    try {
      const file = await apiPost<WorkspaceFileSummary>("/api/workspaces/files", {
        workspaceId: current.id,
        folderId,
        title: transcriptTitle(),
        kind: "transcricao",
      });
      await reload();
      router.push(fileHref(current.id, file.id, { editar: true }));
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "Erro ao criar a transcrição");
      setCreatingFile(false);
    }
  }

  async function linkFolder(folderId: string, opportunityId: string) {
    await apiPatch(`/api/workspaces/folders/${folderId}`, { opportunityId });
    await reload();
  }

  async function saveFolder(name: string) {
    if (folderModal?.mode === "rename") {
      await apiPatch(`/api/workspaces/folders/${folderModal.folder.id}`, { name });
    } else {
      await apiPost("/api/workspaces/folders", { workspaceId: current.id, name });
    }
    await reload();
  }

  async function deleteFolder(folder: WorkspaceFolder) {
    const ok = confirm(
      folder.files.length > 0
        ? `Excluir a pasta "${folder.name}" e ${countLabel(
            folder.files.length,
            "arquivo",
            "arquivos"
          )} dentro dela?`
        : `Excluir a pasta "${folder.name}"?`
    );
    if (!ok) return;
    try {
      await apiDelete(`/api/workspaces/folders/${folder.id}`);
      await reload();
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "Erro ao excluir a pasta");
    }
  }

  async function deleteFile(file: WorkspaceFileSummary) {
    if (!confirm(`Excluir o arquivo "${file.title}"?`)) return;
    try {
      await apiDelete(`/api/workspaces/files/${file.id}`);
      await reload();
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "Erro ao excluir o arquivo");
    }
  }

  async function saveWorkspaceName(name: string) {
    await apiPatch(`/api/workspaces/${current.id}`, { name });
    await reload();
  }

  async function saveWorkspaceDescription(description: string) {
    await apiPatch(`/api/workspaces/${current.id}`, { description });
    await reload();
  }

  async function deleteWorkspace() {
    const ok = confirm(
      `Excluir o espaço "${current.name}"? ${countLabel(
        current.folders.length,
        "pasta",
        "pastas"
      )} e ${countLabel(files.length, "arquivo", "arquivos")} serão apagados.`
    );
    if (!ok) return;
    try {
      await apiDelete(`/api/workspaces/${current.id}`);
      router.push("/espacos");
      await reload();
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "Erro ao excluir o espaço");
    }
  }

  return (
    <div>
      <PageHeader
        crumbs={<WorkspaceCrumbs />}
        title={
          <HeaderTitleInput
            value={current.name}
            onSave={saveWorkspaceName}
            placeholder="Nome do espaço"
            ariaLabel="Nome do espaço"
          />
        }
        subtitle={
          <HeaderSubtitleInput
            value={current.description ?? ""}
            onSave={saveWorkspaceDescription}
            placeholder="Descrição do espaço (opcional)"
          />
        }
        actions={
          <>
            {isOpportunities && (
              <Button onClick={() => setOpportunityOpen(true)}>
                <FolderPlus className="h-4 w-4" /> Nova oportunidade
              </Button>
            )}
            <Button variant="outline" onClick={() => setFolderModal({ mode: "create" })}>
              <FolderPlus className="h-4 w-4" /> Nova pasta
            </Button>
            <Button onClick={() => createFile(null)} disabled={creatingFile} variant={isOpportunities ? "outline" : "primary"}>
              <FilePlus className="h-4 w-4" /> Novo arquivo
            </Button>
            <IconButton title="Editar espaço" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
            </IconButton>
            <IconButton title="Excluir espaço" danger onClick={deleteWorkspace}>
              <Trash2 className="h-4 w-4" />
            </IconButton>
          </>
        }
      />

      <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
        <div
          className="h-1 rounded-full"
          style={{ backgroundColor: current.color }}
          aria-hidden
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <WorkspaceStatCard
            icon={<Folder className="h-4 w-4" />}
            label="Pastas"
            value={String(visibleFolders.length)}
            color={current.color}
          />
          <WorkspaceStatCard
            icon={<FileText className="h-4 w-4" />}
            label="Arquivos"
            value={String(files.length)}
            color={current.color}
          />
          <WorkspaceStatCard
            icon={<Clock className="h-4 w-4" />}
            label="Última edição"
            value={formatDateTime(lastWorkspaceUpdate(current))}
            color={current.color}
          />
        </div>

        {empty ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-center">
            <h2 className="text-base font-semibold text-[var(--foreground)]">
              Este espaço está vazio
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Crie pastas para separar os assuntos, arquivos para escrever o
              conteúdo, ou envie um anexo abaixo.
            </p>
            <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
              {isOpportunities && (
                <Button onClick={() => setOpportunityOpen(true)}>
                  <FolderPlus className="h-4 w-4" /> Nova oportunidade
                </Button>
              )}
              <Button variant="outline" onClick={() => setFolderModal({ mode: "create" })}>
                <FolderPlus className="h-4 w-4" /> Nova pasta
              </Button>
              <Button onClick={() => createFile(null)} disabled={creatingFile}>
                <FilePlus className="h-4 w-4" /> Novo arquivo
              </Button>
            </div>
          </div>
        ) : (
          <>
            <label className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 focus-within:border-[var(--brand)] focus-within:ring-2 focus-within:ring-[var(--brand)]/20">
              <Search className="h-4 w-4 shrink-0 text-[var(--muted)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar arquivos neste espaço"
                className="min-h-11 w-full bg-transparent text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] md:min-h-10"
              />
            </label>

            {term ? (
              <Section title={`Resultados (${results.length})`}>
                {results.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-[var(--border)] py-8 text-center text-sm text-[var(--muted)]">
                    Nenhum arquivo encontrado.
                  </p>
                ) : (
                  <WorkspaceFileList
                    files={results}
                    folderNames={folderNames}
                    onDelete={deleteFile}
                  />
                )}
              </Section>
            ) : (
              <>
                {recent.length > 0 && (
                  <Section title="Editados recentemente">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {recent.map((file) => (
                        <Link
                          key={file.id}
                          href={fileHref(current.id, file.id)}
                          className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--brand)]/40"
                        >
                          <span className="truncate text-[11px] text-[var(--muted)]">
                            {file.folderId
                              ? folderNames.get(file.folderId)
                              : "Sem pasta"}
                          </span>
                          <span className="mt-1 flex items-center gap-1.5">
                            <KindBadge kind={file.kind} />
                            <span className="truncate text-sm font-semibold text-[var(--foreground)]">
                              {file.title}
                            </span>
                          </span>
                          <span className="mt-1 line-clamp-2 min-h-8 text-xs leading-4 text-[var(--muted)]">
                            {file.excerpt || "Sem conteúdo ainda"}
                          </span>
                          <span className="mt-3 text-[11px] text-[var(--muted)]">
                            Editado {formatDateTime(file.updatedAt)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </Section>
                )}

                {isOpportunities && templateFolder && (
                  <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
                    <input
                      type="checkbox"
                      checked={showTemplates}
                      onChange={(event) => setShowTemplates(event.target.checked)}
                    />
                    Templates
                  </label>
                )}

                {visibleFolders.length > 0 && (
                  <Section title={isOpportunities ? "Oportunidades" : "Pastas"}>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {visibleFolders.map((folder) => (
                        <FolderCard
                          key={folder.id}
                          folder={folder}
                          color={current.color}
                          disabled={creatingFile}
                          isOpportunities={isOpportunities && folder.name !== TEMPLATES_FOLDER}
                          funnel={funnel}
                          onCreateFile={() => createFile(folder.id)}
                          onTranscript={() => createTranscript(folder.id)}
                          onImportTranscript={(file) => importTranscriptFile(folder.id, file)}
                          onLink={(opportunityId) => linkFolder(folder.id, opportunityId)}
                          onRename={() => setFolderModal({ mode: "rename", folder })}
                          onDelete={() => deleteFolder(folder)}
                        />
                      ))}
                    </div>
                  </Section>
                )}

                {current.files.length > 0 && (
                  <Section title="Arquivos sem pasta">
                    <WorkspaceFileList files={current.files} onDelete={deleteFile} />
                  </Section>
                )}
              </>
            )}
          </>
        )}

        <WorkspaceAttachments workspaceId={current.id} disabled={creatingFile} />
      </div>

      <NameModal
        open={folderModal !== null}
        title={folderModal?.mode === "rename" ? "Renomear pasta" : "Nova pasta"}
        label="Nome da pasta"
        submitLabel={folderModal?.mode === "rename" ? "Salvar" : "Criar pasta"}
        initialValue={folderModal?.mode === "rename" ? folderModal.folder.name : ""}
        placeholder="Ex.: Propostas, Roteiros, Referências"
        onClose={closeFolderModal}
        onSubmit={saveFolder}
      />
      <WorkspaceFormModal
        open={editOpen}
        onClose={closeEdit}
        workspace={current}
        onSaved={reload}
      />
      <OpportunityFolderModal
        open={opportunityOpen}
        onClose={closeOpportunity}
        onSubmit={createOpportunityFolder}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">{title}</h2>
      {children}
    </section>
  );
}

function FolderCard({
  folder,
  color,
  disabled,
  isOpportunities,
  funnel,
  onCreateFile,
  onTranscript,
  onImportTranscript,
  onLink,
  onRename,
  onDelete,
}: {
  folder: WorkspaceFolder;
  color: string;
  disabled: boolean;
  isOpportunities?: boolean;
  funnel?: FunnelOpportunityChip[];
  onCreateFile: () => void;
  onTranscript?: () => void;
  onImportTranscript?: (file: File) => void;
  onLink?: (opportunityId: string) => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const importRef = useRef<HTMLInputElement>(null);
  return (
    <section className="relative flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <header className="flex items-center gap-2 border-b border-[var(--border)] py-2 pl-4 pr-2">
        <Folder className="h-4 w-4 shrink-0" style={{ color }} />
        <Link
          href={folderHref(folder.workspaceId, folder.id)}
          className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--foreground)] after:absolute after:inset-0 after:rounded-2xl hover:underline"
        >
          {folder.name}
        </Link>
        <span className="relative z-10 shrink-0 text-xs text-[var(--muted)]">
          {folder.files.length}
        </span>
        <div className="relative z-10 flex items-center gap-1">
          {isOpportunities && onTranscript && (
            <Button
              variant="outline"
              className="h-8 min-h-0 px-2 py-1 text-xs"
              onClick={onTranscript}
              disabled={disabled}
            >
              Nova transcrição
            </Button>
          )}
          {isOpportunities && onImportTranscript && (
            <>
              <input
                ref={importRef}
                type="file"
                accept=".txt,.md,.vtt,.srt,.docx,text/plain,text/markdown,text/vtt"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) onImportTranscript(file);
                }}
              />
              <Button
                variant="outline"
                className="h-8 min-h-0 px-2 py-1 text-xs"
                onClick={() => importRef.current?.click()}
                disabled={disabled}
              >
                Importar transcrição
              </Button>
            </>
          )}
          <IconButton title="Novo arquivo nesta pasta" onClick={onCreateFile} disabled={disabled}>
            <FilePlus className="h-4 w-4" />
          </IconButton>
          <IconButton title="Renomear pasta" onClick={onRename}>
            <Pencil className="h-4 w-4" />
          </IconButton>
          <IconButton title="Excluir pasta" danger onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      </header>
      {isOpportunities && (
        <div className="relative z-10 flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-4 py-2">
          {folder.opportunity ? (
            <OpportunityChip opportunity={folder.opportunity} />
          ) : (
            <span className="text-[11px] text-[var(--muted)]">Sem vínculo no funil</span>
          )}
          {onLink && funnel && (
            <select
              value={folder.opportunityId ?? ""}
              onChange={(event) => onLink(event.target.value)}
              aria-label="Vincular ao funil"
              className="h-7 max-w-48 rounded-md border border-[var(--border)] bg-white px-1 text-[11px]"
            >
              <option value="">Desvincular</option>
              {funnel.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.client || row.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
      {folder.files.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-[var(--muted)]">
          Pasta vazia. Clique para abrir.
        </p>
      ) : (
        <ul className="relative z-10 max-h-72 divide-y divide-[var(--border)] overflow-y-auto">
          {folder.files.map((file) => (
            <li key={file.id}>
              <Link
                href={fileHref(file.workspaceId, file.id)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--foreground)] hover:bg-black/[0.02]"
              >
                <FileText className="h-4 w-4 shrink-0 text-[var(--muted)]" />
                <KindBadge kind={file.kind} />
                <span className="min-w-0 flex-1 truncate">{file.title}</span>
                <span className="shrink-0 text-[11px] text-[var(--muted)]">
                  {formatDateTime(file.updatedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="relative z-10">
        <WorkspaceAttachments
          workspaceId={folder.workspaceId}
          folderId={folder.id}
          compact
          disabled={disabled}
        />
      </div>
      {isOpportunities && (
        <div className="relative z-10">
          <FolderDeliveries folderId={folder.id} disabled={disabled} />
        </div>
      )}
    </section>
  );
}
