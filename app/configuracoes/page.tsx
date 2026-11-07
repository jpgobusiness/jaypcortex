"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { Button, Input } from "@/components/ui/form";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/fetcher";
import type { ActivityStatusDef, ActivityType } from "@/lib/types";

export default function ConfiguracoesPage() {
  const [types, setTypes] = useState<ActivityType[]>([]);
  const [statuses, setStatuses] = useState<ActivityStatusDef[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, st] = await Promise.all([
        apiGet<ActivityType[]>("/api/activity-types"),
        apiGet<ActivityStatusDef[]>("/api/activity-statuses"),
      ]);
      setTypes(t);
      setStatuses(st);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Configurações"
      />
      <div className="grid grid-cols-1 gap-6 p-4 lg:grid-cols-2 sm:p-6">
        <ActivityStatusesSection
          statuses={statuses}
          loading={loading}
          onChange={load}
        />
        <TypesSection types={types} loading={loading} onChange={load} />
      </div>
    </div>
  );
}

/* ---------------- Status de atividade ---------------- */

function ActivityStatusesSection({
  statuses,
  loading,
  onChange,
}: {
  statuses: ActivityStatusDef[];
  loading: boolean;
  onChange: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6366f1");

  async function add() {
    if (!newName.trim()) return;
    await apiPost("/api/activity-statuses", { name: newName, color: newColor });
    setNewName("");
    setNewColor("#6366f1");
    onChange();
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h3 className="mb-1 text-sm font-semibold text-[var(--foreground)]">
        Status de atividade
      </h3>
      <p className="mb-4 text-xs text-[var(--muted)]">
        Renomeie, crie ou exclua status. Marque &quot;Conclui&quot; nos status
        que representam atividade finalizada.
      </p>

      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-[var(--muted)]">Carregando...</p>
        ) : (
          statuses.map((s) => (
            <ActivityStatusRow key={s.id} status={s} onChange={onChange} />
          ))
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="h-11 w-11 shrink-0 cursor-pointer rounded-lg border border-[var(--border)]"
          />
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Novo status..."
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
        </div>
        <Button onClick={add} className="w-full sm:w-auto">
          <Plus className="h-4 w-4" /> Adicionar
        </Button>
      </div>
    </section>
  );
}

function ActivityStatusRow({
  status,
  onChange,
}: {
  status: ActivityStatusDef;
  onChange: () => void;
}) {
  const [name, setName] = useState(status.name);
  const [color, setColor] = useState(status.color);
  const [isDone, setIsDone] = useState(status.isDone);
  const [dirty, setDirty] = useState(false);

  async function save() {
    await apiPatch(`/api/activity-statuses/${status.id}`, {
      name,
      color,
      isDone,
    });
    setDirty(false);
    onChange();
  }

  async function remove() {
    if (
      !confirm(
        `Excluir o status "${status.name}"? As atividades nele serão movidas para o primeiro status restante.`
      )
    )
      return;
    try {
      await apiDelete(`/api/activity-statuses/${status.id}`);
      onChange();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao excluir");
    }
  }

  return (
    <div className="rounded-lg border border-[var(--border)] p-3">
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={color}
          onChange={(e) => {
            setColor(e.target.value);
            setDirty(true);
          }}
          className="h-7 w-7 shrink-0 cursor-pointer rounded border border-[var(--border)]"
        />
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setDirty(true);
          }}
          className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium outline-none hover:border-[var(--border)] focus:border-[var(--brand)]"
        />
        <span className="shrink-0 text-xs text-[var(--muted)]">
          {status._count?.activities ?? 0}
        </span>
        <button
          onClick={remove}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 flex items-center gap-3 pl-9 text-xs">
        <label className="flex items-center gap-1.5 text-[var(--muted)]">
          <input
            type="checkbox"
            checked={isDone}
            onChange={(e) => {
              setIsDone(e.target.checked);
              setDirty(true);
            }}
          />
          Conclui a atividade
        </label>
        {dirty && (
          <button
            onClick={save}
            className="ml-auto rounded-md bg-[var(--brand)] px-2.5 py-1 text-xs font-medium text-white hover:bg-[var(--brand-600)]"
          >
            Salvar
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------- Tipos de atividade ---------------- */

function TypesSection({
  types,
  loading,
  onChange,
}: {
  types: ActivityType[];
  loading: boolean;
  onChange: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6366f1");

  async function add() {
    if (!newName.trim()) return;
    await apiPost("/api/activity-types", { name: newName, color: newColor });
    setNewName("");
    setNewColor("#6366f1");
    onChange();
  }

  async function remove(t: ActivityType) {
    if (!confirm(`Excluir o tipo "${t.name}"?`)) return;
    await apiDelete(`/api/activity-types/${t.id}`);
    onChange();
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h3 className="mb-1 text-sm font-semibold text-[var(--foreground)]">
        Tipos de atividade
      </h3>
      <p className="mb-4 text-xs text-[var(--muted)]">
        Ex.: Criar Doc, Criar Proposta, Criar Calculadora.
      </p>

      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-[var(--muted)]">Carregando...</p>
        ) : (
          types.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-2 rounded-lg border border-[var(--border)] p-3"
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: t.color }}
              />
              <span className="flex-1 text-sm font-medium text-[var(--foreground)]">
                {t.name}
              </span>
              <span className="text-xs text-[var(--muted)]">
                {t._count?.activities ?? 0} uso(s)
              </span>
              <button
                onClick={() => remove(t)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="h-11 w-11 shrink-0 cursor-pointer rounded-lg border border-[var(--border)]"
          />
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Novo tipo..."
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
        </div>
        <Button onClick={add} className="w-full sm:w-auto">
          <Plus className="h-4 w-4" /> Adicionar
        </Button>
      </div>
    </section>
  );
}
