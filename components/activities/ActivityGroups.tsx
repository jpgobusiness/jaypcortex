"use client";

import { useState } from "react";
import { FolderPlus, Pencil, Trash2, Archive } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { Button, Input, Label, Textarea } from "@/components/ui/form";
import { apiDelete, apiPatch, apiPost } from "@/lib/fetcher";
import type { ActivityGroupSummary } from "@/lib/types";

const COLORS = ["#6366f1", "#0ea5e9", "#16a34a", "#d97706", "#ef4444", "#8b5cf6", "#64748b"];

export function GroupChip({ name, color }: { name: string; color?: string | null }) {
  const tone = color || "#6366f1";
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: `${tone}1a`, color: tone }}
    >
      {name}
    </span>
  );
}

type Draft = {
  name: string;
  description: string;
  color: string;
  icon: string;
  assigneeEmail: string;
};

const emptyDraft = (): Draft => ({
  name: "",
  description: "",
  color: COLORS[0],
  icon: "",
  assigneeEmail: "",
});

export default function ActivityGroupsBar({
  groups,
  selectedId,
  onSelect,
  onChanged,
}: {
  groups: ActivityGroupSummary[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function startEdit(group: ActivityGroupSummary) {
    setEditingId(group.id);
    setDraft({
      name: group.name,
      description: group.description ?? "",
      color: group.color || COLORS[0],
      icon: group.icon ?? "",
      assigneeEmail: group.assigneeEmail ?? "",
    });
    setError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) {
      setError("Informe o nome do grupo.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      color: draft.color,
      icon: draft.icon.trim() || null,
      assigneeEmail: draft.assigneeEmail.trim() || null,
    };
    try {
      if (editingId) await apiPatch(`/api/activity-groups/${editingId}`, payload);
      else await apiPost("/api/activity-groups", payload);
      setDraft(emptyDraft());
      setEditingId(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar o grupo");
    } finally {
      setSaving(false);
    }
  }

  async function archive(group: ActivityGroupSummary) {
    if (!confirm(`Arquivar "${group.name}"? As atividades continuam.`)) return;
    await apiPatch(`/api/activity-groups/${group.id}`, { archived: true });
    if (selectedId === group.id) onSelect(null);
    onChanged();
  }

  async function remove(group: ActivityGroupSummary) {
    if (!confirm(`Apagar o grupo "${group.name}"? As atividades não são apagadas; só some o vínculo.`)) return;
    await apiDelete(`/api/activity-groups/${group.id}`);
    if (selectedId === group.id) onSelect(null);
    onChanged();
  }

  async function restoreDefaults() {
    setSaving(true);
    setError(null);
    try {
      await apiPost("/api/activity-groups", { defaults: true });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar os grupos padrão");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`rounded-full px-3 py-1 text-xs font-medium ${selectedId === null ? "bg-[var(--brand)] text-white" : "bg-black/[0.05] text-[var(--muted)]"}`}
        >
          Todos os grupos
        </button>
        {groups.map((group) => (
          <button key={group.id} type="button" onClick={() => onSelect(group.id)} className="rounded-full">
            <span className={selectedId === group.id ? "ring-2 ring-[var(--brand)] ring-offset-1 rounded-full inline-flex" : "inline-flex"}>
              <GroupChip name={group.name} color={group.color} />
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setEditingId(null);
            setDraft(emptyDraft());
            setError(null);
          }}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <FolderPlus className="h-3.5 w-3.5" /> Grupos
        </button>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Grupos de atividades"
        footer={
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
            Fechar
          </Button>
        }
      >
        <form onSubmit={save} className="space-y-3">
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
          <div>
            <Label htmlFor="group-name">{editingId ? "Renomear" : "Novo grupo"}</Label>
            <Input id="group-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex.: Nuage" />
          </div>
          <div>
            <Label htmlFor="group-email">Responsável (e-mail)</Label>
            <Input
              id="group-email"
              value={draft.assigneeEmail}
              onChange={(e) => setDraft({ ...draft, assigneeEmail: e.target.value })}
              placeholder="dpsilva@nuageit.com.br"
            />
          </div>
          <div>
            <Label htmlFor="group-desc">Descrição</Label>
            <Textarea id="group-desc" rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={color}
                onClick={() => setDraft({ ...draft, color })}
                className={`h-6 w-6 rounded-full ${draft.color === color ? "ring-2 ring-offset-2 ring-[var(--brand)]" : ""}`}
                style={{ backgroundColor: color }}
              />
            ))}
            <Input className="w-28" value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} placeholder="ícone" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving}>{editingId ? "Salvar" : "Criar grupo"}</Button>
            {editingId && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingId(null);
                  setDraft(emptyDraft());
                }}
              >
                Cancelar edição
              </Button>
            )}
            <Button type="button" variant="outline" onClick={restoreDefaults} disabled={saving}>
              Criar Nuage, Pessoal e David
            </Button>
          </div>
        </form>

        <ul className="mt-4 space-y-2">
          {groups.length === 0 && (
            <li className="text-sm text-[var(--muted)]">Nenhum grupo ainda.</li>
          )}
          {groups.map((group) => (
            <li key={group.id} className="flex items-start justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2">
              <div>
                <GroupChip name={group.name} color={group.color} />
                <p className="mt-1 text-[11px] text-[var(--muted)]">
                  {group.openCount} abertas · {group.overdueCount} atrasadas
                  {group.assigneeEmail ? ` · ${group.assigneeEmail}` : ""}
                </p>
              </div>
              <div className="flex shrink-0">
                <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-black/[0.04]" onClick={() => startEdit(group)} aria-label={`Editar ${group.name}`}>
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-black/[0.04]" onClick={() => archive(group)} aria-label={`Arquivar ${group.name}`}>
                  <Archive className="h-3.5 w-3.5" />
                </button>
                <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-red-50 hover:text-red-600" onClick={() => remove(group)} aria-label={`Apagar ${group.name}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
