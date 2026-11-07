"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Check } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { Button, Input, Label, Textarea } from "@/components/ui/form";
import { apiPatch, apiPost } from "@/lib/fetcher";
import {
  ACCESSORIES,
  AGENT_DESCRIPTION_MAX,
  AGENT_INSTRUCTIONS_MAX,
  AGENT_NAME_MAX,
  AGENT_ROLE_MAX,
  DEFAULT_APPEARANCE,
  HAIR_COLORS,
  HAIR_STYLES,
  SHIRT_COLORS,
  SKIN_TONES,
} from "@/lib/agents";
import type { Agent, AgentAppearance } from "@/lib/types";

const AvatarPreview = dynamic(() => import("@/components/office/ui/AvatarPreview"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-2xl bg-[#eef0f3]" />,
});

type Props = {
  open: boolean;
  /** Agente a editar. Sem ele, cria um novo. */
  agent?: Agent | null;
  /** Aparência inicial de um agente novo. */
  suggestedLook?: AgentAppearance;
  onClose: () => void;
  onSaved: (agent: Agent) => Promise<void> | void;
};

export default function AgentFormModal(props: Props) {
  if (!props.open) return null;
  return <AgentForm {...props} />;
}

function Swatches({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 block text-xs font-medium text-[var(--muted)]">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              title={option.label}
              aria-label={option.label}
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={`flex h-7 w-7 items-center justify-center rounded-full border border-black/10 transition-shadow ${
                selected ? "ring-2 ring-[var(--brand)] ring-offset-2" : ""
              }`}
              style={{ backgroundColor: option.value }}
            >
              {selected && <Check className="h-3.5 w-3.5 text-white drop-shadow" />}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function Chips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 block text-xs font-medium text-[var(--muted)]">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              option.value === value
                ? "border-[#15171c] bg-[#15171c] text-white"
                : "border-[var(--border)] text-slate-600 hover:bg-black/[0.03]"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function AgentForm({ agent, suggestedLook, onClose, onSaved }: Props) {
  const editing = Boolean(agent);
  const robot = agent?.isOrchestrator ?? false;
  const [name, setName] = useState(agent?.name ?? "");
  const [role, setRole] = useState(agent?.role ?? "");
  const [description, setDescription] = useState(agent?.description ?? "");
  const [instructions, setInstructions] = useState(agent?.instructions ?? "");
  const [look, setLook] = useState<AgentAppearance>(() =>
    agent
      ? {
          skinTone: agent.skinTone,
          hairStyle: agent.hairStyle,
          hairColor: agent.hairColor,
          shirtColor: agent.shirtColor,
          accessory: agent.accessory,
        }
      : (suggestedLook ?? DEFAULT_APPEARANCE)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof AgentAppearance>(key: K, value: AgentAppearance[K]) {
    setLook((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const body = { name, role, description, instructions, ...(robot ? {} : look) };
      const saved = agent
        ? await apiPatch<Agent>(`/api/agents/${agent.id}`, body)
        : await apiPost<Agent>("/api/agents", body);
      await onSaved(saved);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao salvar o agente");
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={editing ? `Editar ${agent?.name}` : "Novo agente"}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="agent-form" disabled={!name.trim() || saving}>
            {saving ? "Salvando..." : editing ? "Salvar" : "Criar agente"}
          </Button>
        </>
      }
    >
      <form id="agent-form" onSubmit={submit} className="grid gap-5 md:grid-cols-[1fr_220px]">
        <div className="order-2 space-y-4 md:order-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="agent-name">Nome</Label>
              <Input
                id="agent-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={AGENT_NAME_MAX}
                placeholder="Ex.: Ana"
                autoFocus
                required
              />
            </div>
            <div>
              <Label htmlFor="agent-role">Cargo</Label>
              <Input
                id="agent-role"
                value={role}
                onChange={(event) => setRole(event.target.value)}
                maxLength={AGENT_ROLE_MAX}
                placeholder="Ex.: Redatora de propostas"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="agent-description">O que ele faz</Label>
            <Textarea
              id="agent-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={AGENT_DESCRIPTION_MAX}
              rows={3}
              placeholder="O orquestrador lê isto para decidir quando chamar este agente."
            />
          </div>
          <div>
            <Label htmlFor="agent-instructions">Instruções (opcional)</Label>
            <Textarea
              id="agent-instructions"
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              maxLength={AGENT_INSTRUCTIONS_MAX}
              rows={4}
              placeholder="Como ele deve trabalhar: tom de voz, formato das respostas, o que nunca fazer…"
            />
          </div>
          {!robot && (
            <div className="space-y-3 rounded-2xl bg-[#f6f7f9] p-4">
              <Swatches label="Pele" options={SKIN_TONES} value={look.skinTone} onChange={(value) => update("skinTone", value)} />
              <Chips label="Cabelo" options={HAIR_STYLES} value={look.hairStyle} onChange={(value) => update("hairStyle", value)} />
              <Swatches label="Cor do cabelo" options={HAIR_COLORS} value={look.hairColor} onChange={(value) => update("hairColor", value)} />
              <Swatches label="Roupa" options={SHIRT_COLORS} value={look.shirtColor} onChange={(value) => update("shirtColor", value)} />
              <Chips label="Acessório" options={ACCESSORIES} value={look.accessory} onChange={(value) => update("accessory", value)} />
            </div>
          )}
          {!editing && (
            <p className="text-xs text-[var(--muted)]">
              Ele ganha a primeira mesa livre e uma sala em Espaços de Trabalho, com as pastas Base de conhecimento,
              Templates e Entregas.
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="order-1 h-56 overflow-hidden rounded-2xl bg-gradient-to-b from-[#f7f8fa] to-[#e9ecf1] md:order-2 md:sticky md:top-0 md:h-[300px]">
          <AvatarPreview appearance={look} robot={robot} />
        </div>
      </form>
    </Modal>
  );
}
