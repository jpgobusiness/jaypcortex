"use client";

import {
  BookOpen,
  DoorOpen,
  MessageSquare,
  Pencil,
  Trash2,
  Undo2,
  Users,
  X,
} from "lucide-react";
import AgentAvatar from "@/components/office/ui/AgentAvatar";
import { STATUS_COLORS, type AgentLocation } from "@/components/office/AgentActor";
import type { Agent } from "@/lib/types";

const STATUS_LABELS: Record<AgentLocation, string> = {
  desk: "Trabalhando na mesa",
  walking: "A caminho",
  meeting: "Na mesa geral",
};

/** Data curta (dd/mm/aaaa) para caber no quadradinho do cartão. */
function shortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

type Props = {
  agent: Agent;
  status: AgentLocation;
  atMeeting: boolean;
  onClose: () => void;
  onKnowledge: () => void;
  onRoom: () => void;
  onToggleMeeting: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

/** Cartão do agente selecionado (como o do vídeo: status, números e ações). */
export default function AgentCard({
  agent,
  status,
  atMeeting,
  onClose,
  onKnowledge,
  onRoom,
  onToggleMeeting,
  onEdit,
  onDelete,
}: Props) {
  const place = agent.isOrchestrator
    ? "Sala de vidro"
    : `Mesa ${(agent.deskIndex ?? 0) + 1}`;
  const stats = [
    { label: "Base de conhecimento", value: `${agent.knowledgeCount} ${agent.knowledgeCount === 1 ? "doc" : "docs"}` },
    { label: "Arquivos na sala", value: String(agent.room?.fileCount ?? 0) },
    { label: "Lugar", value: place },
    { label: "No time desde", value: shortDate(agent.createdAt) },
  ];

  return (
    <section
      className="animate-slide-up pointer-events-auto absolute inset-x-3 bottom-3 z-40 max-h-[70%] overflow-y-auto rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.18)] md:inset-x-auto md:bottom-auto md:left-4 md:top-[5.5rem] md:w-[312px] md:max-h-[calc(100%-7rem)]"
      aria-label={`Agente ${agent.name}`}
    >
      <div className="flex items-start gap-3">
        <AgentAvatar agent={agent} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-semibold text-[var(--foreground)]">{agent.name}</h2>
          <p className="truncate text-xs text-[var(--muted)]" title={agent.role || undefined}>
            {agent.role || (agent.isOrchestrator ? "Orquestrador" : "Agente de IA")}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="-mr-1 -mt-1 inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-black/[0.05] hover:text-[var(--foreground)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-2.5 py-1 text-[11px] font-medium text-slate-700">
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }} />
        {STATUS_LABELS[status]}
      </span>

      <dl className="mt-3 grid grid-cols-2 gap-2">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl bg-[#f4f5f7] px-3 py-2">
            <dt className="truncate text-[10.5px] text-[var(--muted)]">{stat.label}</dt>
            <dd className="mt-0.5 truncate text-sm font-semibold text-[var(--foreground)]">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-xs leading-relaxed text-slate-600">
        <span className="font-medium text-slate-800">Função: </span>
        {agent.description ? `“${agent.description}”` : "Sem descrição ainda. Edite o agente para contar o que ele faz."}
      </p>

      <button
        type="button"
        onClick={onKnowledge}
        className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#15171c] text-sm font-medium text-white transition-colors hover:bg-black"
      >
        <BookOpen className="h-4 w-4" /> Base de conhecimento
      </button>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onRoom}
          disabled={!agent.room}
          className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] text-[13px] font-medium text-slate-700 transition-colors hover:bg-black/[0.03] disabled:opacity-50"
        >
          <DoorOpen className="h-4 w-4" /> Ir para a sala
        </button>
        <button
          type="button"
          onClick={onToggleMeeting}
          className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] text-[13px] font-medium text-slate-700 transition-colors hover:bg-black/[0.03]"
        >
          {atMeeting ? <Undo2 className="h-4 w-4" /> : <Users className="h-4 w-4" />}
          {atMeeting ? "Voltar à mesa" : "Mesa geral"}
        </button>
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl text-[13px] font-medium text-slate-600 transition-colors hover:bg-black/[0.04]"
        >
          <Pencil className="h-3.5 w-3.5" /> Editar
        </button>
        {!agent.isOrchestrator && (
          <button
            type="button"
            onClick={onDelete}
            className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </button>
        )}
      </div>
      <div
        className="mt-2 flex h-9 items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--border)] text-xs text-slate-400"
        title="Chega na etapa 4, quando a IA for conectada"
      >
        <MessageSquare className="h-3.5 w-3.5" /> Conversar com {agent.name.split(" ")[0]} · etapa 4
      </div>
    </section>
  );
}
