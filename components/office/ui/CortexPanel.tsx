"use client";

import { Plus, Send, Undo2, Users } from "lucide-react";
import Drawer from "@/components/office/ui/Drawer";
import AgentAvatar from "@/components/office/ui/AgentAvatar";
import type { Agent } from "@/lib/types";

type Props = {
  agents: Agent[];
  meetingActive: boolean;
  onClose: () => void;
  onStartMeeting: () => void;
  onEndMeeting: () => void;
  onCreateAgent: () => void;
  onSelectAgent: (id: string) => void;
};

/**
 * Chat com o Cortex. Nesta etapa ele apresenta a equipe e executa os comandos
 * do escritório; responder pedidos com IA entra na etapa 4.
 */
export default function CortexPanel({
  agents,
  meetingActive,
  onClose,
  onStartMeeting,
  onEndMeeting,
  onCreateAgent,
  onSelectAgent,
}: Props) {
  const cortex = agents.find((agent) => agent.isOrchestrator);
  const team = agents.filter((agent) => !agent.isOrchestrator);
  const chip =
    "inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-black/[0.03]";

  return (
    <Drawer
      title={`${cortex?.name ?? "Cortex"} · ${cortex?.role || "Orquestrador"}`}
      subtitle={
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {team.length} {team.length === 1 ? "agente" : "agentes"} no escritório
        </span>
      }
      icon={cortex ? <AgentAvatar agent={cortex} /> : undefined}
      onClose={onClose}
      footer={
        <form onSubmit={(event) => event.preventDefault()} className="flex items-center gap-2">
          <input
            disabled
            placeholder="Peça algo ao Cortex… (etapa 4)"
            className="min-h-10 min-w-0 flex-1 cursor-not-allowed rounded-xl border border-[var(--border)] bg-[#f6f7f9] px-3 text-slate-400 placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled
            aria-label="Enviar"
            className="inline-flex h-10 w-10 shrink-0 cursor-not-allowed items-center justify-center rounded-xl bg-slate-200 text-slate-400"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      }
    >
      <div className="rounded-2xl rounded-tl-md bg-[#f3f4f6] px-3.5 py-3 text-[13px] leading-relaxed text-slate-700">
        Oi! Eu sou o {cortex?.name ?? "Cortex"}, o orquestrador deste escritório. Você vai me pedir as coisas por aqui:
        eu escolho os agentes certos, chamo todo mundo para a mesa geral e junto as respostas em uma entrega.
      </div>
      <p className="mt-3 rounded-xl border border-[var(--brand)]/20 bg-[var(--brand)]/[0.06] px-3 py-2.5 text-xs leading-relaxed text-[var(--brand-600)]">
        Para eu responder de verdade, falta conectar um modelo de IA. Isso entra na etapa 4 do plano. Os comandos do
        escritório abaixo já funcionam.
      </p>

      <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Comandos</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {meetingActive ? (
          <button type="button" onClick={onEndMeeting} className={chip}>
            <Undo2 className="h-3.5 w-3.5" /> Encerrar reunião
          </button>
        ) : (
          <button type="button" onClick={onStartMeeting} disabled={team.length === 0} className={`${chip} disabled:opacity-50`}>
            <Users className="h-3.5 w-3.5" /> Chamar reunião geral
          </button>
        )}
        <button type="button" onClick={onCreateAgent} className={chip}>
          <Plus className="h-3.5 w-3.5" /> Criar agente
        </button>
      </div>

      <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Equipe</h3>
      {team.length === 0 ? (
        <p className="mt-2 text-xs text-[var(--muted)]">Ainda não há agentes. Crie o primeiro para ele ganhar uma mesa.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {team.map((agent) => (
            <li key={agent.id}>
              <button
                type="button"
                onClick={() => onSelectAgent(agent.id)}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-black/[0.03]"
              >
                <AgentAvatar agent={agent} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-[var(--foreground)]">{agent.name}</span>
                  <span className="block truncate text-[11px] text-[var(--muted)]">{agent.role || "Sem cargo"}</span>
                </span>
                <span className="shrink-0 rounded-full bg-black/[0.04] px-2 py-0.5 text-[10px] text-slate-500">
                  {agent.knowledgeCount} docs
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}
