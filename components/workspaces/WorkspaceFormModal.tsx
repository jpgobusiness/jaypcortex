"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { Button, Input, Label, Textarea } from "@/components/ui/form";
import { apiPatch, apiPost } from "@/lib/fetcher";
import {
  DEFAULT_WORKSPACE_COLOR,
  DESCRIPTION_MAX_LENGTH,
  NAME_MAX_LENGTH,
  WORKSPACE_COLORS,
} from "@/lib/workspaces";
import type { Workspace } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Espaço a editar. Sem ele, o modal cria um espaço novo. */
  workspace?: Workspace | null;
  /** Roda depois de salvar e antes de fechar (ex.: recarregar a lista). */
  onSaved: (workspace: Workspace) => Promise<void> | void;
};

export default function WorkspaceFormModal(props: Props) {
  if (!props.open) return null;
  // O formulário só monta ao abrir, então sempre começa com os dados atuais.
  return <WorkspaceForm {...props} />;
}

function WorkspaceForm({ onClose, workspace, onSaved }: Props) {
  const [name, setName] = useState(workspace?.name ?? "");
  const [description, setDescription] = useState(workspace?.description ?? "");
  const [color, setColor] = useState(workspace?.color ?? DEFAULT_WORKSPACE_COLOR);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = Boolean(workspace);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const body = { name, description, color };
      const saved = workspace
        ? await apiPatch<Workspace>(`/api/workspaces/${workspace.id}`, body)
        : await apiPost<Workspace>("/api/workspaces", body);
      await onSaved(saved);
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Erro ao salvar o espaço"
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? "Editar espaço" : "Novo espaço de trabalho"}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="workspace-form"
            disabled={!name.trim() || saving}
          >
            {saving ? "Salvando..." : editing ? "Salvar" : "Criar espaço"}
          </Button>
        </>
      }
    >
      <form id="workspace-form" onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="workspace-name">Nome</Label>
          <Input
            id="workspace-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={NAME_MAX_LENGTH}
            placeholder="Ex.: NuageIT, Estudos, Conteúdo"
            autoFocus
            required
          />
        </div>
        <div>
          <Label htmlFor="workspace-description">Descrição (opcional)</Label>
          <Textarea
            id="workspace-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={DESCRIPTION_MAX_LENGTH}
            placeholder="Para que serve este espaço"
            rows={3}
          />
        </div>
        <fieldset>
          <legend className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
            Cor
          </legend>
          <div className="flex flex-wrap gap-2">
            {WORKSPACE_COLORS.map((option) => {
              const selected = color === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setColor(option.value)}
                  title={option.label}
                  aria-label={option.label}
                  aria-pressed={selected}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition-shadow ${
                    selected ? "ring-2 ring-offset-2 ring-[var(--foreground)]/30" : ""
                  }`}
                  style={{ backgroundColor: option.value }}
                >
                  {selected && <Check className="h-4 w-4 text-white" />}
                </button>
              );
            })}
          </div>
        </fieldset>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}
