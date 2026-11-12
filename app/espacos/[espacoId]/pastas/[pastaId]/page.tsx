"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Clock, FilePlus, FileText, Trash2 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/form";
import FolderDeliveries from "@/components/workspaces/FolderDeliveries";
import WorkspaceAttachments from "@/components/workspaces/WorkspaceAttachments";
import { HeaderTitleInput } from "@/components/workspaces/IdentityInputs";
import OpportunityChip from "@/components/workspaces/OpportunityChip";
import WorkspaceCrumbs from "@/components/workspaces/WorkspaceCrumbs";
import WorkspaceFileList, {
  IconButton,
} from "@/components/workspaces/WorkspaceFileList";
import WorkspaceStatCard from "@/components/workspaces/WorkspaceStatCard";
import { useWorkspaces } from "@/components/workspaces/WorkspacesProvider";
import { apiDelete, apiGet, apiPatch, apiPost, apiPostForm } from "@/lib/fetcher";
import { transcriptTitle } from "@/lib/opportunities/format";
import { OPPORTUNITIES_KEY, TEMPLATES_FOLDER } from "@/lib/opportunities/constants";
import {
  countLabel,
  fileHref,
  formatDateTime,
  lastFolderUpdate,
  workspaceHref,
} from "@/lib/workspaces";
import type { FunnelOpportunityChip, WorkspaceFileSummary } from "@/lib/types";

export default function PastaPage() {
  const { espacoId, pastaId } = useParams<{ espacoId: string; pastaId: string }>();
  const router = useRouter();
  const { workspaces, loading, reload } = useWorkspaces();
  const workspace = workspaces.find((item) => item.id === espacoId) ?? null;
  const folder = workspace?.folders.find((item) => item.id === pastaId) ?? null;

  const [creatingFile, setCreatingFile] = useState(false);
  const [funnel, setFunnel] = useState<FunnelOpportunityChip[]>([]);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void reload();
  }, [reload, pastaId]);

  const isOpportunities =
    workspace?.key === OPPORTUNITIES_KEY && folder?.name !== TEMPLATES_FOLDER;

  useEffect(() => {
    if (!isOpportunities) return;
    apiGet<FunnelOpportunityChip[]>("/api/opportunities")
      .then(setFunnel)
      .catch(() => setFunnel([]));
  }, [isOpportunities, pastaId]);

  if (!workspace || !folder) {
    return loading ? (
      <p className="py-10 text-center text-[var(--muted)]">Carregando...</p>
    ) : (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-base font-semibold text-[var(--foreground)]">
          Pasta não encontrada
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Ela pode ter sido excluída.
        </p>
        <Link
          href={workspace ? workspaceHref(workspace.id) : "/espacos"}
          className="mt-4 inline-flex text-sm font-medium text-[var(--brand-600)] hover:underline"
        >
          {workspace ? "Voltar para o espaço" : "Ver todos os espaços"}
        </Link>
      </div>
    );
  }

  const current = workspace;
  const currentFolder = folder;

  async function renameFolder(name: string) {
    await apiPatch(`/api/workspaces/folders/${currentFolder.id}`, { name });
    await reload();
  }

  async function createFile() {
    if (creatingFile) return;
    setCreatingFile(true);
    try {
      const file = await apiPost<WorkspaceFileSummary>("/api/workspaces/files", {
        workspaceId: current.id,
        folderId: currentFolder.id,
      });
      await reload();
      router.push(fileHref(current.id, file.id, { editar: true }));
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "Erro ao criar o arquivo");
      setCreatingFile(false);
    }
  }

  async function createTranscript() {
    if (creatingFile) return;
    setCreatingFile(true);
    try {
      const file = await apiPost<WorkspaceFileSummary>("/api/workspaces/files", {
        workspaceId: current.id,
        folderId: currentFolder.id,
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

  async function importTranscriptFile(file: File) {
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
      }>(`/api/workspaces/folders/${currentFolder.id}/transcripts`, form);
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

  async function linkFolder(opportunityId: string) {
    await apiPatch(`/api/workspaces/folders/${currentFolder.id}`, { opportunityId });
    await reload();
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

  async function deleteFolder() {
    const ok = confirm(
      currentFolder.files.length > 0
        ? `Excluir a pasta "${currentFolder.name}" e ${countLabel(
            currentFolder.files.length,
            "arquivo",
            "arquivos"
          )} dentro dela?`
        : `Excluir a pasta "${currentFolder.name}"?`
    );
    if (!ok) return;
    try {
      await apiDelete(`/api/workspaces/folders/${currentFolder.id}`);
      router.push(workspaceHref(current.id));
      await reload();
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "Erro ao excluir a pasta");
    }
  }

  return (
    <div>
      <PageHeader
        crumbs={<WorkspaceCrumbs workspace={current} />}
        title={
          <HeaderTitleInput
            value={currentFolder.name}
            onSave={renameFolder}
            placeholder="Nome da pasta"
            ariaLabel="Nome da pasta"
          />
        }
        subtitle={countLabel(currentFolder.files.length, "arquivo", "arquivos")}
        actions={
          <>
            {isOpportunities && (
              <>
                <Button
                  variant="outline"
                  onClick={() => void createTranscript()}
                  disabled={creatingFile}
                >
                  Nova transcrição
                </Button>
                <input
                  ref={importRef}
                  type="file"
                  accept=".txt,.md,.vtt,.srt,.docx,text/plain,text/markdown,text/vtt"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void importTranscriptFile(file);
                  }}
                />
                <Button
                  variant="outline"
                  onClick={() => importRef.current?.click()}
                  disabled={creatingFile}
                >
                  Importar transcrição
                </Button>
              </>
            )}
            <Button onClick={() => void createFile()} disabled={creatingFile}>
              <FilePlus className="h-4 w-4" /> Novo arquivo
            </Button>
            <IconButton title="Excluir pasta" danger onClick={() => void deleteFolder()}>
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
            icon={<FileText className="h-4 w-4" />}
            label="Arquivos"
            value={String(currentFolder.files.length)}
            color={current.color}
          />
          <WorkspaceStatCard
            icon={<Clock className="h-4 w-4" />}
            label="Última edição"
            value={formatDateTime(lastFolderUpdate(currentFolder))}
            color={current.color}
          />
          <WorkspaceStatCard
            icon={<FileText className="h-4 w-4" />}
            label="Espaço"
            value={current.name}
            color={current.color}
          />
        </div>

        {isOpportunities && (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="mb-2 text-sm font-semibold text-[var(--foreground)]">
              Funil comercial
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {currentFolder.opportunity ? (
                <OpportunityChip opportunity={currentFolder.opportunity} />
              ) : (
                <span className="text-xs text-[var(--muted)]">Sem vínculo no funil</span>
              )}
              <select
                value={currentFolder.opportunityId ?? ""}
                onChange={(event) => void linkFolder(event.target.value)}
                aria-label="Vincular ao funil"
                className="h-9 max-w-64 rounded-lg border border-[var(--border)] bg-white px-2 text-sm"
              >
                <option value="">Desvincular</option>
                {funnel.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.client || row.name}
                  </option>
                ))}
              </select>
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
            Arquivos
          </h2>
          {currentFolder.files.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-center">
              <h3 className="text-base font-semibold text-[var(--foreground)]">
                Esta pasta está vazia
              </h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Crie um arquivo para começar a escrever, ou envie um anexo abaixo.
              </p>
              <div className="mt-5 flex justify-center">
                <Button onClick={() => void createFile()} disabled={creatingFile}>
                  <FilePlus className="h-4 w-4" /> Novo arquivo
                </Button>
              </div>
            </div>
          ) : (
            <WorkspaceFileList files={currentFolder.files} onDelete={deleteFile} />
          )}
        </section>

        <WorkspaceAttachments
          workspaceId={current.id}
          folderId={currentFolder.id}
          disabled={creatingFile}
        />

        {isOpportunities && (
          <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            <FolderDeliveries folderId={currentFolder.id} disabled={creatingFile} standalone />
          </section>
        )}
      </div>
    </div>
  );
}
