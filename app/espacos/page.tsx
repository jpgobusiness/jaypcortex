"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Folder, Layers, Pencil, Plus, Trash2 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/form";
import WorkspaceBadge from "@/components/workspaces/WorkspaceBadge";
import WorkspaceFormModal from "@/components/workspaces/WorkspaceFormModal";
import { useWorkspaces } from "@/components/workspaces/WorkspacesProvider";
import { apiDelete } from "@/lib/fetcher";
import {
  countLabel,
  formatDateTime,
  lastWorkspaceUpdate,
  workspaceFiles,
  workspaceHref,
} from "@/lib/workspaces";
import type { Workspace, WorkspaceTree } from "@/lib/types";

export default function EspacosPage() {
  const { workspaces, loading, error, reload, openCreateWorkspace } =
    useWorkspaces();
  const [editing, setEditing] = useState<Workspace | null>(null);

  // Atualiza as contagens sempre que a página abre.
  useEffect(() => {
    void reload();
  }, [reload]);

  const closeEdit = useCallback(() => setEditing(null), []);

  async function remove(workspace: WorkspaceTree) {
    const files = workspaceFiles(workspace).length;
    const ok = confirm(
      `Excluir o espaço "${workspace.name}"? ${countLabel(
        workspace.folders.length,
        "pasta",
        "pastas"
      )} e ${countLabel(files, "arquivo", "arquivos")} serão apagados.`
    );
    if (!ok) return;
    try {
      await apiDelete(`/api/workspaces/${workspace.id}`);
      await reload();
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "Erro ao excluir o espaço");
    }
  }

  return (
    <div>
      <PageHeader
        title="Espaços de Trabalho"
        subtitle="Cada espaço tem um dashboard, pastas e arquivos com o seu conteúdo."
        actions={
          <Button onClick={openCreateWorkspace}>
            <Plus className="h-4 w-4" /> Novo espaço
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
        {loading ? (
          <p className="py-10 text-center text-[var(--muted)]">Carregando...</p>
        ) : error ? (
          <p className="py-10 text-center text-sm text-red-600">{error}</p>
        ) : workspaces.length === 0 ? (
          <div className="mx-auto max-w-md rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--brand)]/10 text-[var(--brand-600)]">
              <Layers className="h-6 w-6" />
            </span>
            <h2 className="mt-4 text-base font-semibold text-[var(--foreground)]">
              Nenhum espaço ainda
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Crie um espaço para organizar pastas e arquivos de um tema.
            </p>
            <Button onClick={openCreateWorkspace} className="mt-5">
              <Plus className="h-4 w-4" /> Criar espaço
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {workspaces.map((workspace) => (
              <WorkspaceCard
                key={workspace.id}
                workspace={workspace}
                onEdit={() => setEditing(workspace)}
                onDelete={() => remove(workspace)}
              />
            ))}
          </div>
        )}
      </div>

      <WorkspaceFormModal
        open={editing !== null}
        onClose={closeEdit}
        workspace={editing}
        onSaved={reload}
      />
    </div>
  );
}

function WorkspaceCard({
  workspace,
  onEdit,
  onDelete,
}: {
  workspace: WorkspaceTree;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const files = workspaceFiles(workspace).length;

  return (
    <article className="relative flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">
        <WorkspaceBadge workspace={workspace} size="md" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-[var(--foreground)]">
            {/* O link cobre o cartão inteiro. */}
            <Link
              href={workspaceHref(workspace.id)}
              className="after:absolute after:inset-0 after:rounded-2xl"
            >
              {workspace.name}
            </Link>
          </h2>
          {workspace.description && (
            <p className="mt-1 line-clamp-2 text-sm leading-5 text-[var(--muted)]">
              {workspace.description}
            </p>
          )}
        </div>
        <div className="relative z-10 flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onEdit}
            title="Editar espaço"
            aria-label={`Editar ${workspace.name}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-black/[0.05] hover:text-[var(--foreground)]"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Excluir espaço"
            aria-label={`Excluir ${workspace.name}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
        <span className="inline-flex items-center gap-1.5">
          <Folder className="h-3.5 w-3.5" />
          {countLabel(workspace.folders.length, "pasta", "pastas")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          {countLabel(files, "arquivo", "arquivos")}
        </span>
        <span className="ml-auto">
          Atualizado {formatDateTime(lastWorkspaceUpdate(workspace))}
        </span>
      </div>
    </article>
  );
}
