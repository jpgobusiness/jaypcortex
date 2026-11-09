"use client";

import { useEffect, useState } from "react";
import { DESCRIPTION_MAX_LENGTH, NAME_MAX_LENGTH } from "@/lib/workspaces";

/** Campo de título no cabeçalho: salva ao sair do campo. */
export function HeaderTitleInput({
  value,
  onSave,
  placeholder = "Nome",
  ariaLabel = "Nome",
}: {
  value: string;
  onSave: (name: string) => Promise<void>;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  async function commit() {
    const next = draft.trim();
    if (!next) {
      setDraft(value);
      return;
    }
    if (next === value) return;
    try {
      await onSave(next);
    } catch (cause) {
      setDraft(value);
      alert(cause instanceof Error ? cause.message : "Erro ao salvar o nome");
    }
  }

  return (
    <input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(value);
          event.currentTarget.blur();
        }
      }}
      maxLength={NAME_MAX_LENGTH}
      placeholder={placeholder}
      aria-label={ariaLabel}
      title="Clique para editar"
      className="w-full min-w-0 rounded-md bg-transparent px-1 -mx-1 outline-none placeholder:text-[var(--muted)] hover:bg-black/[0.03] focus:bg-black/[0.03] focus:ring-2 focus:ring-[var(--brand)]/20"
    />
  );
}

/** Campo de descrição no cabeçalho: salva ao sair do campo. */
export function HeaderSubtitleInput({
  value,
  onSave,
  placeholder = "Descrição (opcional)",
}: {
  value: string;
  onSave: (description: string) => Promise<void>;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  async function commit() {
    if (draft === value) return;
    try {
      await onSave(draft);
    } catch (cause) {
      setDraft(value);
      alert(cause instanceof Error ? cause.message : "Erro ao salvar a descrição");
    }
  }

  return (
    <input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(value);
          event.currentTarget.blur();
        }
      }}
      maxLength={DESCRIPTION_MAX_LENGTH}
      placeholder={placeholder}
      aria-label="Descrição"
      title="Clique para editar"
      className="w-full min-w-0 rounded-md bg-transparent px-1 -mx-1 outline-none placeholder:text-[var(--muted)] hover:bg-black/[0.03] focus:bg-black/[0.03] focus:ring-2 focus:ring-[var(--brand)]/20"
    />
  );
}
