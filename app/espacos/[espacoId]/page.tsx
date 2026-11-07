"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import NameModal from "@/components/workspaces/NameModal";
import WorkspaceFormModal from "@/components/workspaces/WorkspaceFormModal";
import { useWorkspaces } from "@/components/workspaces/WorkspacesProvider";
import { apiDelete, apiPatch, apiPost } from "@/lib/fetcher";
import {
  countLabel,
  fileHref,
  formatDateTime,
  lastWorkspaceUpdate,
  workspaceFiles,
} from "@/lib/workspaces";
import type { WorkspaceFileSummary, WorkspaceFolder } from "@/lib/types";

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

  // Atualiza o dashboard sempre que o espaço abre (prévias e datas dos arquivos).
  useEffect(() => {
    void reload();
  }, [reload, espacoId]);

  const closeFolderModal = useCallback(() => setFolderModal(null), []);
  const closeEdit = useCallback(() => setEditOpen(false), []);

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
  const recent = [...files]
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
  const empty = current.folders.length === 0 && current.files.length === 0;

  async function createFile(folderId: string | null) {
    if (creatingFile) return;
    setCreatingFile(true);
    try {
      const file = await apiPost<WorkspaceFileSummary>("/api/workspaces/files", {
        workspaceId: current.id,
        folderId,
      });
      await reload();
      router.push(fileHref(current.id, file.id));
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "Erro ao criar o arquivo");
      setCreatingFile(false);
    }
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
        title={current.name}
        subtitle={current.description ?? "Dashboard do espaço"}
        actions={
          <>
            <Button variant="outline" onClick={() => setFolderModal({ mode: "create" })}>
              <FolderPlus className="h-4 w-4" /> Nova pasta
            </Button>
            <Button onClick={() => createFile(null)} disabled={creatingFile}>
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
          <StatCard
            icon={<Folder className="h-4 w-4" />}
            label="Pastas"
            value={String(current.folders.length)}
            color={current.color}
          />
          <StatCard
            icon={<FileText className="h-4 w-4" />}
            label="Arquivos"
            value={String(files.length)}
            color={current.color}
          />
          <StatCard
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
              Crie pastas para separar os assuntos e arquivos para escrever o
              conteúdo.
            </p>
            <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
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
                  <FileList
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
                          <span className="mt-1 truncate text-sm font-semibold text-[var(--foreground)]">
                            {file.title}
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

                {current.folders.length > 0 && (
                  <Section title="Pastas">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {current.folders.map((folder) => (
                        <FolderCard
                          key={folder.id}
                          folder={folder}
                          color={current.color}
                          disabled={creatingFile}
                          onCreateFile={() => createFile(folder.id)}
                          onRename={() => setFolderModal({ mode: "rename", folder })}
                          onDelete={() => deleteFolder(folder)}
                        />
                      ))}
                    </div>
                  </Section>
                )}

                {current.files.length > 0 && (
                  <Section title="Arquivos sem pasta">
                    <FileList files={current.files} onDelete={deleteFile} />
                  </Section>
                )}
              </>
            )}
          </>
        )}
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

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}1a`, color }}
        >
          {icon}
        </span>
        {label}
      </div>
      <p className="mt-2 truncate text-2xl font-bold text-[var(--foreground)]">
        {value}
      </p>
    </div>
  );
}

function FolderCard({
  folder,
  color,
  disabled,
  onCreateFile,
  onRename,
  onDelete,
}: {
  folder: WorkspaceFolder;
  color: string;
  disabled: boolean;
  onCreateFile: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <section className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <header className="flex items-center gap-2 border-b border-[var(--border)] py-2 pl-4 pr-2">
        <Folder className="h-4 w-4 shrink-0" style={{ color }} />
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--foreground)]">
          {folder.name}
        </h3>
        <span className="shrink-0 text-xs text-[var(--muted)]">
          {folder.files.length}
        </span>
        <IconButton title="Novo arquivo nesta pasta" onClick={onCreateFile} disabled={disabled}>
          <FilePlus className="h-4 w-4" />
        </IconButton>
        <IconButton title="Renomear pasta" onClick={onRename}>
          <Pencil className="h-4 w-4" />
        </IconButton>
        <IconButton title="Excluir pasta" danger onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </IconButton>
      </header>
      {folder.files.length === 0 ? (
        <button
          type="button"
          onClick={onCreateFile}
          disabled={disabled}
          className="px-4 py-6 text-center text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          Pasta vazia. Clique para criar um arquivo.
        </button>
      ) : (
        <ul className="max-h-72 divide-y divide-[var(--border)] overflow-y-auto">
          {folder.files.map((file) => (
            <li key={file.id}>
              <Link
                href={fileHref(file.workspaceId, file.id)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--foreground)] hover:bg-black/[0.02]"
              >
                <FileText className="h-4 w-4 shrink-0 text-[var(--muted)]" />
                <span className="min-w-0 flex-1 truncate">{file.title}</span>
                <span className="shrink-0 text-[11px] text-[var(--muted)]">
                  {formatDateTime(file.updatedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FileList({
  files,
  folderNames,
  onDelete,
}: {
  files: WorkspaceFileSummary[];
  /** Quando informado, mostra a pasta de cada arquivo. */
  folderNames?: Map<string, string>;
  onDelete: (file: WorkspaceFileSummary) => void;
}) {
  return (
    <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      {files.map((file) => (
        <li key={file.id} className="flex items-center gap-3 py-2 pl-4 pr-2 hover:bg-black/[0.02]">
          <FileText className="h-4 w-4 shrink-0 text-[var(--muted)]" />
          <Link href={fileHref(file.workspaceId, file.id)} className="min-w-0 flex-1 py-1">
            <span className="block truncate text-sm font-medium text-[var(--foreground)]">
              {file.title}
            </span>
            <span className="block truncate text-xs text-[var(--muted)]">
              {folderNames
                ? `${file.folderId ? folderNames.get(file.folderId) : "Sem pasta"}${
                    file.excerpt ? ` · ${file.excerpt}` : ""
                  }`
                : file.excerpt || "Sem conteúdo ainda"}
            </span>
          </Link>
          <span className="hidden shrink-0 text-[11px] text-[var(--muted)] sm:block">
            {formatDateTime(file.updatedAt)}
          </span>
          <IconButton title="Excluir arquivo" danger onClick={() => onDelete(file)}>
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </li>
      ))}
    </ul>
  );
}

function IconButton({
  title,
  danger = false,
  disabled = false,
  onClick,
  children,
}: {
  title: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition-colors disabled:opacity-50 ${
        danger
          ? "hover:bg-red-50 hover:text-red-600"
          : "hover:bg-black/[0.05] hover:text-[var(--foreground)]"
      }`}
    >
      {children}
    </button>
  );
}
