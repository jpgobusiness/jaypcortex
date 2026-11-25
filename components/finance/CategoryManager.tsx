"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Plus, Star, Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { Button, Input, Select } from "@/components/ui/form";
import { useFinance } from "@/components/finance/FinanceProvider";
import { FinIcon, ICON_CHOICES, IconBubble } from "@/components/finance/icons";
import { ColorSwatches, ErrorNote, Segmented } from "@/components/finance/ui";
import { apiDelete, apiPatch, apiPost } from "@/lib/fetcher";
import { PALETTE } from "@/lib/finance/constants";
import type { FinCategory, FlowKind } from "@/lib/finance/types";

const errorText = (cause: unknown) => (cause instanceof Error ? cause.message : "Não foi possível salvar");

export default function CategoryManager({ onClose }: { onClose: () => void }) {
  const { categories, refresh } = useFinance();
  const [kind, setKind] = useState<FlowKind>("expense");
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("tag");
  const [color, setColor] = useState(PALETTE[0]);
  const [parentId, setParentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const list = categories.filter((category) => category.kind === kind);
  const parents = list.filter((category) => !category.parentId);
  const childrenOf = (id: string) => list.filter((category) => category.parentId === id);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  const add = () =>
    run(async () => {
      if (!name.trim()) throw new Error("Dê um nome para a categoria");
      await apiPost("/api/financas/categories", { name, kind, icon, color, parentId: parentId || null });
      setName("");
      setParentId("");
    });

  const patch = (category: FinCategory, body: Record<string, unknown>) => run(() => apiPatch(`/api/financas/categories/${category.id}`, body));

  const remove = (category: FinCategory) =>
    run(async () => {
      if (!confirm(`Excluir ${category.name}? Os lançamentos ficam sem categoria.`)) return;
      await apiDelete(`/api/financas/categories/${category.id}`);
    });

  const renderRow = (category: FinCategory, child = false) => (
      <li key={category.id} className={`flex items-center gap-3 py-2 ${child ? "pl-9" : ""} ${category.archived ? "opacity-50" : ""}`}>
        <IconBubble icon={category.icon} color={category.color} size="sm" />
        <input
          defaultValue={category.name}
          aria-label="Nome da categoria"
          onBlur={(event) => {
            const value = event.target.value.trim();
            if (value && value !== category.name) void patch(category, { name: value });
          }}
          className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 text-sm outline-none focus:bg-black/[0.04]"
        />
        {kind === "expense" && (
          <button
            type="button"
            onClick={() => void patch(category, { essential: !category.essential })}
            title={category.essential ? "Essencial (necessidade)" : "Marcar como essencial"}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              category.essential ? "bg-amber-50 text-amber-700" : "text-[var(--muted)] hover:bg-black/[0.04]"
            }`}
          >
            <Star className="h-3 w-3" /> {category.essential ? "Essencial" : "Desejo"}
          </button>
        )}
        <button
          type="button"
          onClick={() => void patch(category, { archived: !category.archived })}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-black/[0.05]"
          title={category.archived ? "Reativar" : "Arquivar"}
        >
          {category.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
        </button>
        {!category.system && (
          <button type="button" onClick={() => void remove(category)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50" title="Excluir">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </li>
  );

  return (
    <Modal open onClose={onClose} title="Categorias" size="lg">
      <div className="space-y-4">
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: "expense", label: "Despesas" },
            { value: "income", label: "Receitas" },
          ]}
        />
        <ErrorNote message={error} />
        <div className="rounded-2xl bg-black/[0.03] p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Nova categoria</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={kind === "expense" ? "Ex.: Academia" : "Ex.: Aluguel recebido"} />
            <Select value={parentId} onChange={(event) => setParentId(event.target.value)} className="sm:max-w-52">
              <option value="">Categoria principal</option>
              {parents.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  Dentro de {parent.name}
                </option>
              ))}
            </Select>
            <Button onClick={add} disabled={busy}>
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            {ICON_CHOICES.map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => setIcon(choice)}
                aria-label={choice}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${icon === choice ? "bg-white text-[var(--brand-600)] shadow-sm" : "text-[var(--muted)] hover:bg-white"}`}
              >
                <FinIcon name={choice} />
              </button>
            ))}
          </div>
          <div className="mt-3">
            <ColorSwatches colors={PALETTE} value={color} onChange={setColor} />
          </div>
        </div>
        <ul className="divide-y divide-[var(--border)]">
          {parents.map((parent) => (
            <li key={parent.id}>
              <ul>
                {renderRow(parent)}
                {childrenOf(parent.id).map((child) => renderRow(child, true))}
              </ul>
            </li>
          ))}
        </ul>
        {kind === "expense" && (
          <p className="text-xs text-[var(--muted)]">
            Essencial = necessidade (moradia, saúde, mercado). Usamos isso na reserva de emergência e na regra 50/30/20.
          </p>
        )}
      </div>
    </Modal>
  );
}
