"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import {
  Button,
  Input,
  Label,
  Select,
  Textarea,
  FormRow,
} from "@/components/ui/form";
import { apiPost, apiPatch, apiGet } from "@/lib/fetcher";
import { toDateInput } from "@/lib/format";
import {
  ACTIVITY_PRIORITY_LABELS,
  type Activity,
  type ActivityPriority,
  type ActivityStatusDef,
  type ActivityType,
} from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: (activity: Activity) => void;
  types: ActivityType[];
  statuses: ActivityStatusDef[];
  activity?: Activity | null;
};

type FormState = {
  title: string;
  typeId: string;
  status: string;
  priority: ActivityPriority;
  dueDate: string;
  notes: string;
  description: string;
  estimatedMinutes: string;
  importance: string;
  urgency: string;
  energy: string;
  context: string;
  tags: string;
  area: string;
  waitingOn: string;
};

const empty = (status = "pending"): FormState => ({
  title: "",
  typeId: "",
  status,
  priority: "normal",
  dueDate: "",
  notes: "",
  description: "",
  estimatedMinutes: "",
  importance: "",
  urgency: "",
  energy: "",
  context: "",
  tags: "",
  area: "",
  waitingOn: "",
});

export default function ActivityModal({
  open,
  onClose,
  onSaved,
  types,
  statuses,
  activity,
}: Props) {
  const isEdit = Boolean(activity);
  const [form, setForm] = useState<FormState>(empty());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<{ id: string; type: string; at: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setHistory([]);
    if (activity) {
      setForm({
        title: activity.title,
        typeId: activity.typeId ?? "",
        status: activity.status,
        priority: activity.priority,
        dueDate: toDateInput(activity.dueDate),
        notes: activity.notes ?? "",
        description: activity.description ?? "",
        estimatedMinutes: activity.estimatedMinutes != null ? String(activity.estimatedMinutes) : "",
        importance: activity.importance != null ? String(activity.importance) : "",
        urgency: activity.urgency != null ? String(activity.urgency) : "",
        energy: activity.energy ?? "",
        context: activity.context ?? "",
        tags: (activity.tags ?? []).join(", "),
        area: activity.area ?? "",
        waitingOn: activity.waitingOn ?? "",
      });
      apiGet<{ id: string; type: string; at: string }[]>(`/api/activities/${activity.id}/history`)
        .then(setHistory)
        .catch(() => setHistory([]));
    } else {
      setForm(empty(statuses[0]?.key ?? "pending"));
    }
  }, [open, activity, statuses]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Informe o título da atividade.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      title: form.title,
      typeId: form.typeId || null,
      status: form.status,
      priority: form.priority,
      dueDate: form.dueDate || null,
      notes: form.notes || null,
      description: form.description || null,
      estimatedMinutes: form.estimatedMinutes ? Number(form.estimatedMinutes) : null,
      importance: form.importance ? Number(form.importance) : null,
      urgency: form.urgency ? Number(form.urgency) : null,
      energy: form.energy || null,
      context: form.context || null,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      area: form.area || null,
      waitingOn: form.waitingOn || null,
    };
    try {
      const saved =
        isEdit && activity
          ? await apiPatch<Activity>(`/api/activities/${activity.id}`, payload)
          : await apiPost<Activity>("/api/activities", payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar atividade" : "Nova atividade"}
      footer={
        <>
          <Button variant="outline" onClick={onClose} type="button">
            Cancelar
          </Button>
          <Button type="submit" form="activity-form" disabled={saving}>
            {saving ? "Salvando..." : isEdit ? "Salvar" : "Criar"}
          </Button>
        </>
      }
    >
      <form id="activity-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <div>
          <Label htmlFor="title">Título *</Label>
          <Input
            id="title"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Ex.: Criar proposta comercial"
            autoFocus
          />
        </div>

        <FormRow>
          <div>
            <Label htmlFor="typeId">Tipo</Label>
            <Select
              id="typeId"
              value={form.typeId}
              onChange={(e) => set("typeId", e.target.value)}
            >
              <option value="">—</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              id="status"
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
            >
              {statuses.map((s) => (
                <option key={s.id} value={s.key}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
        </FormRow>

        <FormRow>
          <div>
            <Label htmlFor="priority">Prioridade</Label>
            <Select
              id="priority"
              value={form.priority}
              onChange={(e) =>
                set("priority", e.target.value as ActivityPriority)
              }
            >
              {(
                Object.keys(ACTIVITY_PRIORITY_LABELS) as ActivityPriority[]
              ).map((p) => (
                <option key={p} value={p}>
                  {ACTIVITY_PRIORITY_LABELS[p]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="dueDate">Prazo</Label>
            <Input
              id="dueDate"
              type="date"
              value={form.dueDate}
              onChange={(e) => set("dueDate", e.target.value)}
            />
          </div>
        </FormRow>

        <div>
          <Label htmlFor="notes">Observações</Label>
          <Textarea
            id="notes"
            rows={3}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="description">Detalhe</Label>
          <Textarea
            id="description"
            rows={2}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </div>

        <FormRow>
          <div>
            <Label htmlFor="estimatedMinutes">Estimativa (min)</Label>
            <Input
              id="estimatedMinutes"
              type="number"
              min={0}
              value={form.estimatedMinutes}
              onChange={(e) => set("estimatedMinutes", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="energy">Energia</Label>
            <Select id="energy" value={form.energy} onChange={(e) => set("energy", e.target.value)}>
              <option value="">—</option>
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </Select>
          </div>
        </FormRow>

        <FormRow>
          <div>
            <Label htmlFor="importance">Importância (1–4)</Label>
            <Input
              id="importance"
              type="number"
              min={1}
              max={4}
              value={form.importance}
              onChange={(e) => set("importance", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="urgency">Urgência (1–4)</Label>
            <Input
              id="urgency"
              type="number"
              min={1}
              max={4}
              value={form.urgency}
              onChange={(e) => set("urgency", e.target.value)}
            />
          </div>
        </FormRow>

        <FormRow>
          <div>
            <Label htmlFor="context">Contexto</Label>
            <Input
              id="context"
              placeholder="@computador"
              value={form.context}
              onChange={(e) => set("context", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="area">Área</Label>
            <Input
              id="area"
              placeholder="profissional, pessoal…"
              value={form.area}
              onChange={(e) => set("area", e.target.value)}
            />
          </div>
        </FormRow>

        <FormRow>
          <div>
            <Label htmlFor="tags">Tags (vírgula)</Label>
            <Input id="tags" value={form.tags} onChange={(e) => set("tags", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="waitingOn">Aguardando</Label>
            <Input
              id="waitingOn"
              value={form.waitingOn}
              onChange={(e) => set("waitingOn", e.target.value)}
            />
          </div>
        </FormRow>

        {activity?.source && activity.source !== "ui" && (
          <p className="text-[11px] text-[var(--muted)]">Origem: {activity.source}</p>
        )}
        {history.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-[var(--muted)]">Histórico</p>
            <ul className="max-h-28 space-y-1 overflow-auto text-[11px] text-[var(--muted)]">
              {history.slice(0, 8).map((h) => (
                <li key={h.id}>
                  {h.type} · {new Date(h.at).toLocaleString("pt-BR")}
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </Modal>
  );
}
