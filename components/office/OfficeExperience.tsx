"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
  Undo2,
  Users,
} from "lucide-react";
import * as THREE from "three";
import OfficeCanvas from "@/components/office/OfficeCanvas";
import { AgentLabels } from "@/components/office/AgentLabels";
import type { AgentLocation, Speech } from "@/components/office/AgentActor";
import type { CameraApi } from "@/components/office/CameraRig";
import AgentCard from "@/components/office/ui/AgentCard";
import AgentFormModal from "@/components/office/ui/AgentFormModal";
import CortexPanel from "@/components/office/ui/CortexPanel";
import KnowledgePanel from "@/components/office/ui/KnowledgePanel";
import { STARTER_TEAM, suggestedLook } from "@/components/office/presets";
import { useWorkspaces } from "@/components/workspaces/WorkspacesProvider";
import { apiDelete, apiGet, apiPost } from "@/lib/fetcher";
import { firstName } from "@/lib/agents";
import { workspaceHref } from "@/lib/workspaces";
import type { Agent } from "@/lib/types";

type Panel = { kind: "cortex" } | { kind: "knowledge"; agentId: string } | null;
type Form = { mode: "create" } | { mode: "edit"; agent: Agent } | null;

const SPEECH_INTERVAL = 4200;

function greeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function clip(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Fala de cada um na mesa geral, montada com o que está cadastrado no agente. */
function speechFor(agent: Agent, turn: number, cortexName: string): Speech {
  if (agent.isOrchestrator) {
    const lines = [
      "Reunião geral! Cada um conta rapidinho em que pode ajudar.",
      "Quando a IA estiver ligada, eu divido os pedidos do chat aqui na mesa.",
    ];
    return { id: `${agent.id}-${turn}`, header: `${firstName(agent.name)} → equipe`, text: lines[turn % lines.length] };
  }
  const text = agent.description
    ? clip(agent.description, 150)
    : agent.role
      ? `Eu cuido de ${agent.role.toLowerCase()}.`
      : "Pronto para ajudar no que precisar.";
  return { id: `${agent.id}-${turn}`, header: `${firstName(agent.name)} → ${cortexName}`, text };
}

/** Escritório 3D dos agentes: cena, painéis e ações. */
export default function OfficeExperience() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { reload: reloadWorkspaces } = useWorkspaces();
  const container = useRef<HTMLDivElement>(null);
  const cameraApi = useRef<CameraApi | null>(null);
  const registry = useRef(new Map<string, THREE.Object3D>());
  const labels = useRef(new Map<string, HTMLDivElement>());
  const setLabel = useCallback((id: string, element: HTMLDivElement | null) => {
    if (element) labels.current.set(id, element);
    else labels.current.delete(id);
  }, []);

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [meetingIds, setMeetingIds] = useState<Set<string>>(() => new Set());
  const [statuses, setStatuses] = useState<Record<string, AgentLocation>>({});
  const [panel, setPanel] = useState<Panel>(null);
  const [form, setForm] = useState<Form>(null);
  const [turn, setTurn] = useState(0);
  const [creatingTeam, setCreatingTeam] = useState(false);
  const deepLink = useRef(searchParams.get("agente"));

  const load = useCallback(
    () =>
      apiGet<Agent[]>("/api/agents").then(
        (data) => {
          setAgents(data);
          setError(null);
          setLoading(false);
        },
        (cause: unknown) => {
          setError(cause instanceof Error ? cause.message : "Erro ao carregar os agentes");
          setLoading(false);
        }
      ),
    []
  );

  useEffect(() => {
    void load();
  }, [load]);

  const cortex = agents.find((agent) => agent.isOrchestrator) ?? null;
  const team = useMemo(() => agents.filter((agent) => !agent.isOrchestrator), [agents]);
  const selected = agents.find((agent) => agent.id === selectedId) ?? null;
  const meetingActive = meetingIds.size > 0;
  const participants = useMemo(
    () => agents.filter((agent) => statuses[agent.id] === "meeting"),
    [agents, statuses]
  );

  // Na mesa geral, cada participante fala um pouco, um de cada vez.
  useEffect(() => {
    if (participants.length === 0) return;
    const timer = window.setInterval(() => setTurn((value) => value + 1), SPEECH_INTERVAL);
    return () => window.clearInterval(timer);
  }, [participants.length]);

  const speeches = useMemo(() => {
    if (participants.length === 0) return {};
    const ordered = [...participants].sort((a, b) => Number(b.isOrchestrator) - Number(a.isOrchestrator));
    const speaker = ordered[turn % ordered.length];
    const cortexName = firstName(cortex?.name ?? "Cortex");
    return { [speaker.id]: speechFor(speaker, Math.floor(turn / ordered.length), cortexName) } as Record<string, Speech>;
  }, [participants, turn, cortex?.name]);

  const handleStatus = useCallback((id: string, status: AgentLocation) => {
    setStatuses((current) => (current[id] === status ? current : { ...current, [id]: status }));
  }, []);

  const focusAgent = useCallback((id: string) => {
    const object = registry.current.get(id);
    if (object) cameraApi.current?.focus(object);
  }, []);

  const selectAgent = useCallback(
    (id: string) => {
      setSelectedId(id);
      setPanel((current) => (current?.kind === "knowledge" ? { kind: "knowledge", agentId: id } : current));
      focusAgent(id);
    },
    [focusAgent]
  );

  const deselect = useCallback(() => {
    if (!selectedId) return;
    setSelectedId(null);
    if (meetingIds.size > 0) cameraApi.current?.meeting();
    else cameraApi.current?.home();
  }, [selectedId, meetingIds.size]);

  // Abre direto num agente (link "Ver no escritório").
  useEffect(() => {
    const id = deepLink.current;
    if (!id || !agents.some((agent) => agent.id === id)) return;
    deepLink.current = null;
    const timer = window.setTimeout(() => selectAgent(id), 450);
    return () => window.clearTimeout(timer);
  }, [agents, selectAgent]);

  function startMeeting() {
    // Toda reunião começa com o orquestrador abrindo a rodada.
    setTurn(0);
    setMeetingIds(new Set(agents.map((agent) => agent.id)));
    setSelectedId(null);
    cameraApi.current?.meeting();
  }

  function endMeeting() {
    setMeetingIds(new Set());
    setSelectedId(null);
    cameraApi.current?.home();
  }

  function toggleMeeting(id: string) {
    setMeetingIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function afterSave(agent: Agent, created: boolean) {
    await load();
    if (created) {
      await reloadWorkspaces();
      window.setTimeout(() => selectAgent(agent.id), 350);
    }
  }

  async function removeAgent(agent: Agent) {
    const files = agent.room?.fileCount ?? 0;
    const ok = confirm(
      `Excluir ${agent.name}? A sala${files ? ` (com ${files} ${files === 1 ? "arquivo" : "arquivos"})` : ""} continua em Espaços de Trabalho.`
    );
    if (!ok) return;
    try {
      await apiDelete(`/api/agents/${agent.id}`);
      setSelectedId(null);
      setPanel(null);
      setMeetingIds((current) => {
        const next = new Set(current);
        next.delete(agent.id);
        return next;
      });
      cameraApi.current?.home();
      await load();
      await reloadWorkspaces();
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "Erro ao excluir o agente");
    }
  }

  async function createStarterTeam() {
    if (creatingTeam) return;
    setCreatingTeam(true);
    try {
      for (const preset of STARTER_TEAM) {
        await apiPost("/api/agents", preset);
      }
      await load();
      await reloadWorkspaces();
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "Erro ao criar a equipe");
      await load();
    } finally {
      setCreatingTeam(false);
    }
  }

  function toggleFullscreen() {
    const element = container.current;
    if (!element) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void element.requestFullscreen?.();
  }

  const knowledgeAgent = panel?.kind === "knowledge" ? agents.find((agent) => agent.id === panel.agentId) ?? null : null;
  const inMeeting = participants.filter((agent) => !agent.isOrchestrator).length;
  const dashboard = useMemo(
    () => ({
      agents: team.map((agent) => ({ name: firstName(agent.name), knowledge: agent.knowledgeCount })),
      totalDocs: team.reduce((sum, agent) => sum + agent.knowledgeCount, 0),
      inMeeting,
    }),
    [team, inMeeting]
  );
  const cortexLine = meetingActive
    ? "Reunião geral em andamento"
    : `${team.length} ${team.length === 1 ? "agente pronto" : "agentes prontos"}`;

  const [now] = useState(() => new Date());
  const pill =
    "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors";

  return (
    <div ref={container} className="relative min-h-0 flex-1 overflow-hidden bg-[#eceef2]">
      <div className="absolute inset-0">
        <OfficeCanvas
          agents={agents}
          meetingIds={meetingIds}
          statuses={statuses}
          speeches={speeches}
          selectedId={selectedId}
          dashboard={dashboard}
          cortexLine={cortexLine}
          cameraApi={cameraApi}
          registry={registry}
          labels={labels}
          onSelect={selectAgent}
          onDeselect={deselect}
          onStatus={handleStatus}
        />
      </div>
      <AgentLabels
        agents={agents}
        statuses={statuses}
        speeches={speeches}
        selectedId={selectedId}
        onSelect={selectAgent}
        onLabelRef={setLabel}
      />

      {/* Saudação, como o "Good evening, Admin" do vídeo. */}
      <div className="pointer-events-none absolute left-4 top-4 z-40 max-w-[calc(100%-2rem)]">
        <div className="pointer-events-auto rounded-2xl border border-black/[0.05] bg-white/90 px-4 py-2.5 shadow-[0_6px_24px_rgba(15,23,42,0.08)] backdrop-blur">
          <p className="text-[15px] font-semibold text-[var(--foreground)]">{greeting(now)}!</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--muted)]">
            <span className={`h-1.5 w-1.5 rounded-full ${meetingActive ? "bg-[var(--brand)]" : "bg-emerald-500"}`} />
            {loading
              ? "Carregando a equipe..."
              : meetingActive
                ? `${inMeeting} na mesa geral · reunião em andamento`
                : `${team.length} ${team.length === 1 ? "agente" : "agentes"} · ${firstName(cortex?.name ?? "Cortex")} orquestrando`}
          </p>
        </div>
      </div>

      {/* Ações do escritório. */}
      <div className="absolute right-4 top-4 z-40 flex max-w-[calc(100%-2rem)] flex-wrap items-center justify-end gap-2">
        <div className="flex items-center gap-1 rounded-full border border-black/[0.05] bg-white/90 p-1 shadow-[0_6px_24px_rgba(15,23,42,0.08)] backdrop-blur">
          <button type="button" onClick={() => setPanel({ kind: "cortex" })} className={`${pill} text-slate-700 hover:bg-black/[0.04]`}>
            <span className="h-2 w-2 rounded-full bg-[var(--brand)]" />
            <span className="hidden sm:inline">Pedir ao {firstName(cortex?.name ?? "Cortex")}</span>
            <span className="sm:hidden">Chat</span>
          </button>
          <button type="button" onClick={() => setForm({ mode: "create" })} className={`${pill} bg-[#15171c] text-white hover:bg-black`}>
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Novo agente</span>
          </button>
          {meetingActive ? (
            <button type="button" onClick={endMeeting} className={`${pill} bg-[#ef4f2b] text-white hover:bg-[#dc4423]`}>
              <Undo2 className="h-4 w-4" /> <span className="hidden sm:inline">Encerrar reunião</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={startMeeting}
              disabled={team.length === 0}
              className={`${pill} text-slate-700 hover:bg-black/[0.04] disabled:opacity-40`}
            >
              <Users className="h-4 w-4" /> <span className="hidden sm:inline">Reunião geral</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setSelectedId(null);
              if (meetingActive) cameraApi.current?.meeting();
              else cameraApi.current?.home();
            }}
            title="Voltar para a visão geral"
            aria-label="Voltar para a visão geral"
            className={`${pill} w-9 justify-center px-0 text-slate-600 hover:bg-black/[0.04]`}
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            title="Tela cheia"
            aria-label="Tela cheia"
            className={`${pill} hidden w-9 justify-center px-0 text-slate-600 hover:bg-black/[0.04] sm:inline-flex`}
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Zoom. */}
      <div className="absolute bottom-6 right-4 z-40 hidden flex-col overflow-hidden rounded-full border border-black/[0.05] bg-white/90 shadow-[0_6px_24px_rgba(15,23,42,0.08)] backdrop-blur md:flex">
        <button type="button" onClick={() => cameraApi.current?.zoom(2.2)} aria-label="Aproximar" className="flex h-9 w-9 items-center justify-center text-slate-600 hover:bg-black/[0.04]">
          <Plus className="h-4 w-4" />
        </button>
        <span className="mx-2 h-px bg-[var(--border)]" />
        <button type="button" onClick={() => cameraApi.current?.zoom(-2.2)} aria-label="Afastar" className="flex h-9 w-9 items-center justify-center text-slate-600 hover:bg-black/[0.04]">
          <Minus className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="absolute left-1/2 top-24 z-40 -translate-x-1/2 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700 shadow">
          {error}{" "}
          <button type="button" onClick={() => void load()} className="font-medium underline">
            Tentar de novo
          </button>
        </div>
      )}

      {!loading && !error && team.length === 0 && !selected && (
        <div className="animate-slide-up absolute bottom-6 left-1/2 z-40 w-[min(460px,calc(100%-2rem))] -translate-x-1/2 rounded-2xl border border-black/[0.05] bg-white/95 p-5 text-center shadow-[0_18px_50px_rgba(15,23,42,0.16)] backdrop-blur">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand)]/10 text-[var(--brand-600)]">
            <Sparkles className="h-5 w-5" />
          </span>
          <h2 className="mt-3 text-base font-semibold text-[var(--foreground)]">O escritório está pronto</h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
            Cada agente ganha uma mesa, uma sala com pastas e uma base de conhecimento. O {firstName(cortex?.name ?? "Cortex")} já está
            na sala de vidro para orquestrar.
          </p>
          <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
            <button type="button" onClick={() => setForm({ mode: "create" })} className={`${pill} justify-center bg-[#15171c] text-white hover:bg-black`}>
              <Plus className="h-4 w-4" /> Criar agente
            </button>
            <button
              type="button"
              onClick={createStarterTeam}
              disabled={creatingTeam}
              className={`${pill} justify-center border border-[var(--border)] text-slate-700 hover:bg-black/[0.03] disabled:opacity-60`}
            >
              <Users className="h-4 w-4" /> {creatingTeam ? "Montando a equipe..." : `Montar equipe sugerida (${STARTER_TEAM.length})`}
            </button>
          </div>
        </div>
      )}

      {selected && (
        <AgentCard
          key={`card-${selected.id}`}
          agent={selected}
          status={statuses[selected.id] ?? "desk"}
          atMeeting={meetingIds.has(selected.id)}
          onClose={deselect}
          onKnowledge={() => setPanel({ kind: "knowledge", agentId: selected.id })}
          onRoom={() => selected.room && router.push(workspaceHref(selected.room.id))}
          onToggleMeeting={() => toggleMeeting(selected.id)}
          onEdit={() => setForm({ mode: "edit", agent: selected })}
          onDelete={() => void removeAgent(selected)}
        />
      )}

      {panel?.kind === "cortex" && (
        <CortexPanel
          agents={agents}
          meetingActive={meetingActive}
          onClose={() => setPanel(null)}
          onStartMeeting={startMeeting}
          onEndMeeting={endMeeting}
          onCreateAgent={() => setForm({ mode: "create" })}
          onSelectAgent={(id) => {
            setPanel(null);
            selectAgent(id);
          }}
        />
      )}

      {knowledgeAgent && (
        <KnowledgePanel
          key={`knowledge-${knowledgeAgent.id}`}
          agent={knowledgeAgent}
          onClose={() => setPanel(null)}
          onChanged={() => void load()}
        />
      )}

      <AgentFormModal
        open={form !== null}
        agent={form?.mode === "edit" ? form.agent : null}
        suggestedLook={suggestedLook(team.length)}
        onClose={() => setForm(null)}
        onSaved={(agent) => afterSave(agent, form?.mode === "create")}
      />
    </div>
  );
}
