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
import { apiPost, apiPatch } from "@/lib/fetcher";
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
};

const empty = (status = "pending"): FormState => ({
  title: "",
  typeId: "",
  status,
  priority: "normal",
  dueDate: "",
  notes: "",
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

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (activity) {
      setForm({
        title: activity.title,
        typeId: activity.typeId ?? "",
        status: activity.status,
        priority: activity.priority,
        dueDate: toDateInput(activity.dueDate),
        notes: activity.notes ?? "",
      });
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
      ...form,
      typeId: form.typeId || null,
      dueDate: form.dueDate || null,
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
      </form>
    </Modal>
  );
}
