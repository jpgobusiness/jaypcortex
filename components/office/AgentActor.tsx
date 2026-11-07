"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useCursor } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import Character, { createMotion, type Motion } from "@/components/office/Character";
import Robot from "@/components/office/Robot";
import { COLORS, hashString } from "@/components/office/palette";
import {
  angleDelta,
  meetingSeat,
  pathToHome,
  pathToMeeting,
  type Home,
  type Pose,
  type Vec2,
} from "@/components/office/layout";
import type { Agent } from "@/lib/types";

export type AgentLocation = "desk" | "walking" | "meeting";
export type Speech = { id: string; header: string; text: string };

type Phase = "seated" | "waiting" | "rising" | "walking" | "turning" | "lowering";
type Trip = { to: "desk" | "meeting"; from: Pose; path: Vec2[]; index: number; final: Pose };

const RISE_TIME = 0.42;
const WALK_SPEED = 1.7;
const GLIDE_SPEED = 1.9;

export const STATUS_COLORS: Record<AgentLocation, string> = {
  desk: "#22c55e",
  walking: "#f59e0b",
  meeting: COLORS.brand,
};

function approach(value: number, target: number, amount: number) {
  if (value < target) return Math.min(target, value + amount);
  return Math.max(target, value - amount);
}

type Props = {
  agent: Agent;
  home: Home;
  seat: number;
  atMeeting: boolean;
  /** Segundos de espera antes de sair (deixa a fila de agentes escalonada). */
  delay: number;
  /** Onde ele está agora (o anel no chão só aparece fora da mesa dele). */
  status: AgentLocation;
  selected: boolean;
  speech: Speech | null;
  registry: RefObject<Map<string, THREE.Object3D>>;
  onSelect: (id: string) => void;
  onStatus: (id: string, status: AgentLocation) => void;
};

/** Um agente no escritório: anda entre a mesa dele e a mesa geral. */
export default function AgentActor({
  agent,
  home,
  seat,
  atMeeting,
  delay,
  status,
  selected,
  speech,
  registry,
  onSelect,
  onStatus,
}: Props) {
  const robot = agent.isOrchestrator;
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const motion = useRef<Motion>(createMotion(!robot));
  const state = useRef<{ location: "desk" | "meeting"; phase: Phase; timer: number; trip: Trip | null }>({
    location: "desk",
    phase: "seated",
    timer: 0,
    trip: null,
  });
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  const latest = useRef({ home, seat, onStatus, id: agent.id });
  useEffect(() => {
    latest.current = { home, seat, onStatus, id: agent.id };
  });

  // Começa sentado em casa.
  useLayoutEffect(() => {
    const g = group.current;
    if (!g) return;
    g.position.set(home.pose.x, 0, home.pose.z);
    g.rotation.y = home.pose.rotation;
    // Só na montagem: depois disso quem move o agente é o useFrame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Se a mesa mudar enquanto ele está nela, vai direto para a nova.
  const { x: homeX, z: homeZ, rotation: homeRotation } = home.pose;
  useEffect(() => {
    const s = state.current;
    const g = group.current;
    if (!g || s.phase !== "seated" || s.location !== "desk") return;
    g.position.set(homeX, 0, homeZ);
    g.rotation.y = homeRotation;
  }, [homeX, homeZ, homeRotation]);

  useEffect(() => {
    const map = registry.current;
    const g = group.current;
    if (g) map?.set(agent.id, g);
    return () => {
      map?.delete(agent.id);
    };
  }, [agent.id, registry]);

  // Mudou o destino (mesa ↔ mesa geral).
  useEffect(() => {
    const s = state.current;
    const g = group.current;
    if (!g) return;
    const want = atMeeting ? "meeting" : "desk";
    const heading = s.trip?.to ?? s.location;
    if (want === heading) return;

    const seatPose = meetingSeat(seat);
    const homePose = home.pose;
    const destination = want === "desk" ? homePose : seatPose;

    if (s.trip && (s.phase === "waiting" || s.phase === "rising")) {
      // Ainda não saiu do lugar: desiste e senta de novo.
      s.trip = null;
      s.phase = robot ? "seated" : "lowering";
      s.timer = RISE_TIME * (1 - motion.current.sit);
      onStatus(agent.id, s.location);
      return;
    }

    if (s.trip && s.phase === "walking") {
      // A caminho: volta pelo mesmo trajeto.
      const back = s.trip.path.slice(0, s.trip.index).reverse();
      s.trip = { to: want, from: s.trip.final, path: [...back, s.trip.from], index: 0, final: s.trip.from };
      return;
    }

    if (s.trip) {
      // Chegando (virando ou sentando): conta como chegou e sai de novo.
      s.location = s.trip.to;
      s.trip = null;
    }

    const path = want === "meeting" ? pathToMeeting(home, seat) : pathToHome(home, seat);
    s.trip = { to: want, from: want === "meeting" ? homePose : seatPose, path, index: 0, final: destination };
    s.phase = "waiting";
    s.timer = delay;
    onStatus(agent.id, "walking");
    // As outras dependências mudam junto com estas ou não alteram a viagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atMeeting]);

  useFrame(({ clock }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const s = state.current;
    const m = motion.current;
    const g = group.current;
    if (!g) return;

    const arrive = () => {
      if (!s.trip) return;
      s.location = s.trip.to;
      s.trip = null;
      s.phase = "seated";
      latest.current.onStatus(latest.current.id, s.location);
    };

    m.talk = approach(m.talk, speech ? 1 : 0, delta * 4);

    switch (s.phase) {
      case "seated":
        m.sit = robot ? 0 : approach(m.sit, 1, delta * 3);
        m.walk = approach(m.walk, 0, delta * 5);
        m.typing = approach(m.typing, !robot && s.location === "desk" && !speech ? 1 : 0, delta * 3);
        break;
      case "waiting":
        s.timer -= delta;
        m.typing = approach(m.typing, 0, delta * 4);
        if (s.timer <= 0) {
          s.phase = robot ? "walking" : "rising";
          s.timer = RISE_TIME;
        }
        break;
      case "rising":
        s.timer -= delta;
        m.typing = approach(m.typing, 0, delta * 6);
        m.sit = Math.max(0, s.timer / RISE_TIME);
        if (s.timer <= 0) {
          m.sit = 0;
          s.phase = s.trip ? "walking" : "seated";
        }
        break;
      case "walking": {
        const trip = s.trip;
        if (!trip) {
          s.phase = "seated";
          break;
        }
        const target = trip.path[trip.index];
        const dx = target.x - g.position.x;
        const dz = target.z - g.position.z;
        const distance = Math.hypot(dx, dz);
        const step = (robot ? GLIDE_SPEED : WALK_SPEED) * delta * Math.max(0.35, m.walk);
        m.walk = approach(m.walk, 1, delta * 5);
        m.phase += delta * 9.5;
        if (distance > 0.001) {
          const heading = Math.atan2(dx, dz);
          g.rotation.y += angleDelta(g.rotation.y, heading) * Math.min(1, delta * 9);
        }
        if (distance <= step) {
          g.position.x = target.x;
          g.position.z = target.z;
          trip.index += 1;
          if (trip.index >= trip.path.length) s.phase = "turning";
        } else {
          g.position.x += (dx / distance) * step;
          g.position.z += (dz / distance) * step;
        }
        break;
      }
      case "turning": {
        const trip = s.trip;
        if (!trip) {
          s.phase = "seated";
          break;
        }
        m.walk = approach(m.walk, 0, delta * 5);
        const d = angleDelta(g.rotation.y, trip.final.rotation);
        g.rotation.y += d * Math.min(1, delta * 7);
        if (Math.abs(d) < 0.03) {
          g.rotation.y = trip.final.rotation;
          if (robot) {
            arrive();
          } else {
            s.phase = "lowering";
            s.timer = RISE_TIME;
          }
        }
        break;
      }
      case "lowering":
        s.timer -= delta;
        m.walk = approach(m.walk, 0, delta * 6);
        m.sit = 1 - Math.max(0, s.timer / RISE_TIME);
        if (s.timer <= 0) {
          m.sit = 1;
          if (s.trip) arrive();
          else s.phase = "seated";
        }
        break;
    }

    if (ring.current) {
      const pulse = 1 + Math.sin(clock.elapsedTime * 4) * 0.05;
      ring.current.scale.set(pulse, pulse, pulse);
    }
  });

  function select(event: ThreeEvent<MouseEvent>) {
    // Arrastar a câmera também solta o clique: só seleciona se foi um toque.
    if (event.delta > 6) return;
    event.stopPropagation();
    onSelect(agent.id);
  }

  const seed = hashString(agent.id) % 1000;

  return (
    <group ref={group}>
      {robot ? (
        <Robot motion={motion} />
      ) : (
        <Character appearance={agent} motion={motion} seed={seed} />
      )}

      <mesh
        position={[0, 0.75, 0]}
        visible={false}
        onClick={select}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <cylinderGeometry args={[0.38, 0.38, 1.55, 12]} />
        <meshBasicMaterial />
      </mesh>

      {(selected || hovered) && (robot || status !== "desk") && (
        <mesh ref={ring} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.44, 0.53, 48]} />
          <meshBasicMaterial color={COLORS.brand} transparent opacity={selected ? 0.9 : 0.45} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}
