"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import { Button, Input, Label, Select } from "@/components/ui/form";
import { apiGet } from "@/lib/fetcher";
import { opportunityChipLabel } from "@/lib/opportunities/format";
import { NAME_MAX_LENGTH } from "@/lib/workspaces";
import type { FunnelOpportunityChip } from "@/lib/types";

type FunnelRow = FunnelOpportunityChip & { folders?: { id: string }[] };

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string, opportunityId?: string) => Promise<void>;
};

export default function OpportunityFolderModal(props: Props) {
  if (!props.open) return null;
  return <Form {...props} />;
}

function Form({ onClose, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [opportunityId, setOpportunityId] = useState("");
  const [rows, setRows] = useState<FunnelRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<FunnelRow[]>("/api/opportunities")
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit(name.trim(), opportunityId || undefined);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao criar");
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Nova oportunidade"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="opportunity-folder-form" disabled={!name.trim() || saving}>
            {saving ? "Criando..." : "Criar"}
          </Button>
        </>
      }
    >
      <form id="opportunity-folder-form" onSubmit={submit} className="space-y-3">
        <div>
          <Label htmlFor="opp-name">Nome da pasta</Label>
          <Input
            id="opp-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={NAME_MAX_LENGTH}
            placeholder='Ex.: [TAMURA] Proposal'
            autoFocus
            required
          />
        </div>
        <div>
          <Label htmlFor="opp-funnel">Oportunidade do funil (opcional)</Label>
          <Select
            id="opp-funnel"
            value={opportunityId}
            onChange={(event) => setOpportunityId(event.target.value)}
          >
            <option value="">Sem vínculo</option>
            {rows.map((row) => (
              <option key={row.id} value={row.id}>
                {opportunityChipLabel(row)}
              </option>
            ))}
          </Select>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}
