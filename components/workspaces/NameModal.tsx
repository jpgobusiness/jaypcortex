"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { Button, Input, Label } from "@/components/ui/form";
import { NAME_MAX_LENGTH } from "@/lib/workspaces";

type Props = {
  open: boolean;
  title: string;
  label: string;
  submitLabel: string;
  initialValue?: string;
  placeholder?: string;
  onClose: () => void;
  /** Recebe o nome digitado. Se lançar erro, a mensagem aparece no modal. */
  onSubmit: (name: string) => Promise<void>;
};

/** Modal simples para criar ou renomear algo pelo nome (ex.: pastas). */
export default function NameModal(props: Props) {
  if (!props.open) return null;
  return <NameForm {...props} />;
}

function NameForm({
  title,
  label,
  submitLabel,
  initialValue = "",
  placeholder,
  onClose,
  onSubmit,
}: Props) {
  const [name, setName] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit(name.trim());
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao salvar");
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="name-form" disabled={!name.trim() || saving}>
            {saving ? "Salvando..." : submitLabel}
          </Button>
        </>
      }
    >
      <form id="name-form" onSubmit={submit} className="space-y-3">
        <div>
          <Label htmlFor="name-input">{label}</Label>
          <Input
            id="name-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={NAME_MAX_LENGTH}
            placeholder={placeholder}
            autoFocus
            required
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}
