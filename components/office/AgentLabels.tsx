"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { STATUS_COLORS, type AgentLocation, type Speech } from "@/components/office/AgentActor";
import { firstName } from "@/lib/agents";
import type { Agent } from "@/lib/types";

/** Altura da etiqueta acima do chão, por tipo de agente. */
export function labelHeight(agent: Agent) {
  return agent.isOrchestrator ? 1.8 : 1.6;
}

type LabelsProps = {
  agents: Agent[];
  statuses: Record<string, AgentLocation>;
  speeches: Record<string, Speech>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onLabelRef: (id: string, element: HTMLDivElement | null) => void;
};

/**
 * Etiquetas e balões de fala dos agentes, em HTML por cima da cena.
 * O LabelProjector (dentro do Canvas) posiciona cada uma a cada quadro.
 */
export function AgentLabels({ agents, statuses, speeches, selectedId, onSelect, onLabelRef }: LabelsProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden" aria-hidden={false}>
      {agents.map((agent) => {
        const selected = selectedId === agent.id;
        const speech = speeches[agent.id];
        const status = statuses[agent.id] ?? "desk";
        return (
          <div
            key={agent.id}
            ref={(element) => onLabelRef(agent.id, element)}
            className="absolute left-0 top-0 will-change-transform"
            style={{ transform: "translate3d(-9999px, -9999px, 0)" }}
          >
            <div className="flex -translate-x-1/2 -translate-y-full flex-col items-center pb-1">
              {speech && (
                <div
                  key={speech.id}
                  className="animate-bubble-in relative mb-2 w-max max-w-[230px] rounded-xl bg-white px-3 py-2 shadow-[0_8px_24px_rgba(15,23,42,0.16)]"
                >
                  <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--brand-600)]">
                    {speech.header}
                  </p>
                  <p className="mt-0.5 line-clamp-3 text-[11.5px] leading-snug text-slate-700">{speech.text}</p>
                  <span className="absolute left-1/2 top-full -ml-[7px] border-x-[7px] border-t-[7px] border-x-transparent border-t-white" />
                </div>
              )}
              <button
                type="button"
                onClick={() => onSelect(agent.id)}
                title={agent.role ? `${agent.name} · ${agent.role}` : agent.name}
                className={`pointer-events-auto flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] leading-[14px] shadow-[0_2px_10px_rgba(15,23,42,0.14)] transition-colors ${
                  selected ? "bg-[#15171c] text-white" : "bg-white/95 text-slate-800 hover:bg-white"
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }} />
                <span className="font-semibold">{firstName(agent.name)}</span>
                {agent.role && (
                  // O LabelProjector esconde o cargo quando a cena fica cheia (data-role).
                  <span data-role="" className={`max-w-[120px] truncate ${selected ? "text-white/60" : "text-slate-400"}`}>
                    {agent.role}
                  </span>
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type ProjectorProps = {
  agents: Agent[];
  selectedId: string | null;
  registry: React.RefObject<Map<string, THREE.Object3D>>;
  labels: React.RefObject<Map<string, HTMLDivElement>>;
};

/** Vetor de trabalho reaproveitado a cada quadro (evita criar objetos no loop). */
const scratch = new THREE.Vector3();

type Box = { left: number; top: number; right: number; bottom: number };
type Placement = {
  id: string;
  element: HTMLDivElement;
  x: number;
  y: number;
  distance: number;
  priority: number;
  measured: Measured;
};

/** Espaço mínimo entre etiquetas (px). */
const GAP = 2;
/** Velocidade com que a etiqueta desliza até o lugar livre (1/s). */
const SETTLE_SPEED = 10;
/** Tentativas de desvio por etiqueta em cada quadro. */
const MAX_NUDGES = 8;
/** Quadros seguidos pedindo a troca antes de mostrar/esconder o cargo (evita piscar). */
const FLIP_FRAMES = 12;
/**
 * Desvio (px) a partir do qual vale esconder o cargo para a etiqueta caber perto da cabeça.
 * Alto o bastante para a fila de mesas manter os cargos (só escadinha), e baixo o
 * bastante para a mesa geral, onde todos ficam colados, mostrar só os nomes.
 */
const COMPACT_AFTER = 28;

function overlaps(a: Box, b: Box) {
  return a.left < b.right + GAP && a.right + GAP > b.left && a.top < b.bottom + GAP && a.bottom + GAP > b.top;
}

function shift(box: Box, dx: number, dy: number): Box {
  return { left: box.left + dx, right: box.right + dx, top: box.top + dy, bottom: box.bottom + dy };
}

type Measured = {
  /** Balão de fala, se o agente estiver falando. */
  bubble: Box | null;
  /** Pílula com o cargo e sem ele (iguais quando não há cargo). */
  full: Box;
  compact: Box;
  role: HTMLElement | null;
  isCompact: boolean;
};

/**
 * Caixas na tela do balão e da pílula de uma etiqueta ancorada em (x, y).
 * A coluna fica centrada em x com a base em y; os filhos são centralizados nela.
 * `roleWidths` guarda a largura do cargo (com o espaço antes dele) medida quando
 * ele estava visível, para saber o tamanho cheio mesmo com o cargo escondido.
 */
function measure(id: string, element: HTMLDivElement, x: number, y: number, roleWidths: Map<string, number>): Measured | null {
  const column = element.firstElementChild as HTMLElement | null;
  const pill = column?.lastElementChild as HTMLElement | null | undefined;
  if (!column || !pill) return null;
  const top = y - column.offsetHeight;
  const box = (child: HTMLElement, width: number): Box => {
    const childTop = top + child.offsetTop - column.offsetTop;
    return { left: x - width / 2, right: x + width / 2, top: childTop, bottom: childTop + child.offsetHeight };
  };

  const role = pill.querySelector<HTMLElement>("[data-role]");
  const isCompact = role?.style.display === "none";
  if (role && !isCompact) {
    const name = role.previousElementSibling as HTMLElement | null;
    if (name) roleWidths.set(id, role.offsetLeft + role.offsetWidth - (name.offsetLeft + name.offsetWidth));
  }
  const roleWidth = role ? (roleWidths.get(id) ?? 0) : 0;
  const fullWidth = pill.offsetWidth + (isCompact ? roleWidth : 0);
  const first = column.firstElementChild as HTMLElement;

  return {
    bubble: first !== pill ? box(first, first.offsetWidth) : null,
    full: box(pill, fullWidth),
    compact: box(pill, fullWidth - roleWidth),
    role,
    isCompact,
  };
}

/**
 * Desloca a etiqueta o mínimo possível para não cobrir as que já foram colocadas:
 * de lado (para longe da outra) ou para cima, o que for menor.
 */
function nudge(boxes: Box[], placed: Box[]): [number, number] {
  let dx = 0;
  let dy = 0;
  for (let attempt = 0; attempt < MAX_NUDGES; attempt++) {
    let mine: Box | null = null;
    let other: Box | null = null;
    for (const box of boxes) {
      const moved = shift(box, dx, dy);
      const hit = placed.find((candidate) => overlaps(moved, candidate));
      if (hit) {
        mine = moved;
        other = hit;
        break;
      }
    }
    if (!mine || !other) break;
    const up = other.top - GAP - mine.bottom;
    const leftOfOther = mine.left + mine.right < other.left + other.right;
    const side = leftOfOther ? other.left - GAP - mine.right : other.right + GAP - mine.left;
    if (Math.abs(side) < Math.abs(up)) dx += side;
    else dy += up;
  }
  return [dx, dy];
}

/** Posição da etiqueta na tela (px) e distância até a câmera. */
function project(object: THREE.Object3D, height: number, camera: THREE.Camera, width: number, heightPx: number) {
  object.getWorldPosition(scratch);
  scratch.y += height;
  const distance = camera.position.distanceTo(scratch);
  scratch.project(camera);
  return {
    visible: scratch.z > -1 && scratch.z < 1,
    x: Math.round((scratch.x * 0.5 + 0.5) * width),
    y: Math.round((-scratch.y * 0.5 + 0.5) * heightPx),
    distance,
  };
}

const HIDDEN = "translate3d(-9999px, -9999px, 0)";

/**
 * Dentro do Canvas: projeta a posição de cada agente na tela e move a etiqueta.
 * Quando duas etiquetas se cobrem (ex.: todos em volta da mesa geral), a de menor
 * prioridade desliza para o lado ou para cima e, se precisar, mostra só o nome.
 * Prioridade: quem está falando, depois o selecionado, depois quem está mais
 * perto da câmera.
 */
export function LabelProjector({ agents, selectedId, registry, labels }: ProjectorProps) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const last = useRef(new Map<string, string>());
  const offsets = useRef(new Map<string, { x: number; y: number }>());
  const roleWidths = useRef(new Map<string, number>());
  const flips = useRef(new Map<string, number>());

  useFrame((_, delta) => {
    const objects = registry.current;
    const elements = labels.current;
    if (!objects || !elements) return;

    const placements: Placement[] = [];
    for (const agent of agents) {
      const element = elements.get(agent.id);
      const object = objects.get(agent.id);
      if (!element || !object) continue;
      const { visible, x, y, distance } = project(object, labelHeight(agent), camera, size.width, size.height);
      const measured = visible ? measure(agent.id, element, x, y, roleWidths.current) : null;
      if (!measured) {
        offsets.current.delete(agent.id);
        if (last.current.get(agent.id) !== HIDDEN) {
          last.current.set(agent.id, HIDDEN);
          positionLabel(element, HIDDEN, 1);
        }
        continue;
      }
      const priority = (measured.bubble ? 2 : 0) + (agent.id === selectedId ? 1 : 0);
      placements.push({ id: agent.id, element, x, y, distance, priority, measured });
    }

    placements.sort((a, b) => b.priority - a.priority || a.distance - b.distance);
    const placed: Box[] = [];
    const ease = 1 - Math.exp(-SETTLE_SPEED * Math.min(delta, 0.1));

    for (const item of placements) {
      const { bubble, full, compact, role, isCompact } = item.measured;
      const above = bubble ? [bubble] : [];
      const fullBoxes = [...above, full];
      const smallBoxes = [...above, compact];
      const fullTarget = nudge(fullBoxes, placed);
      let smallTarget: [number, number] | null = null;
      const cost = ([dx, dy]: [number, number]) => Math.abs(dx) + Math.abs(dy);

      // Cena cheia: se só o nome cabe bem mais perto da cabeça, esconde o cargo.
      // Quem fala ou está selecionado mantém a etiqueta inteira.
      let wantCompact = false;
      if (role && item.priority === 0 && cost(fullTarget) > COMPACT_AFTER) {
        smallTarget = nudge(smallBoxes, placed);
        wantCompact = cost(smallTarget) + 6 < cost(fullTarget);
      }
      // Só troca depois de alguns quadros pedindo a mesma coisa, para não piscar
      // com os agentes andando. Etiqueta fixada (fala/seleção) volta na hora.
      let useCompact = isCompact;
      if (wantCompact === isCompact) {
        flips.current.delete(item.id);
      } else if (!wantCompact && item.priority > 0) {
        useCompact = false;
      } else {
        const frames = (flips.current.get(item.id) ?? 0) + 1;
        flips.current.set(item.id, frames);
        if (frames >= FLIP_FRAMES) {
          useCompact = wantCompact;
          flips.current.delete(item.id);
        }
      }
      if (role && useCompact !== isCompact) role.style.display = useCompact ? "none" : "";

      const boxes = useCompact ? smallBoxes : fullBoxes;
      const [targetX, targetY] = useCompact ? (smallTarget ?? nudge(smallBoxes, placed)) : fullTarget;
      for (const box of boxes) placed.push(shift(box, targetX, targetY));

      // Desliza até o lugar livre em vez de pular (fica suave com os agentes andando).
      const offset = offsets.current.get(item.id);
      let ox = targetX;
      let oy = targetY;
      if (offset) {
        ox = offset.x + (targetX - offset.x) * ease;
        oy = offset.y + (targetY - offset.y) * ease;
        offset.x = ox;
        offset.y = oy;
      } else {
        offsets.current.set(item.id, { x: ox, y: oy });
      }

      const transform = `translate3d(${Math.round(item.x + ox)}px, ${Math.round(item.y + oy)}px, 0)`;
      const zIndex = Math.max(1, Math.round(1000 - item.distance * 20)) + item.priority * 1000;
      // Só mexe no DOM quando a posição ou a ordem mudam.
      const key = `${transform}|${zIndex}`;
      if (last.current.get(item.id) !== key) {
        last.current.set(item.id, key);
        positionLabel(item.element, transform, zIndex);
      }
    }
  });

  return null;
}

function positionLabel(element: HTMLDivElement, transform: string, zIndex: number) {
  element.style.transform = transform;
  element.style.zIndex = String(zIndex);
}
