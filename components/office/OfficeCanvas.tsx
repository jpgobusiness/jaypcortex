"use client";

import { Suspense, type RefObject } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer, SoftShadows } from "@react-three/drei";
import * as THREE from "three";
import AgentActor, { type AgentLocation, type Speech } from "@/components/office/AgentActor";
import { LabelProjector } from "@/components/office/AgentLabels";
import CameraRig, { type CameraApi } from "@/components/office/CameraRig";
import OfficeRoom from "@/components/office/OfficeRoom";
import { COLORS } from "@/components/office/palette";
import { CAMERA_HOME, ORCHESTRATOR, deskHome } from "@/components/office/layout";
import type { DashboardData } from "@/components/office/textures";
import type { Agent } from "@/lib/types";

type Props = {
  agents: Agent[];
  meetingIds: Set<string>;
  statuses: Record<string, AgentLocation>;
  speeches: Record<string, Speech>;
  selectedId: string | null;
  dashboard: DashboardData;
  cortexLine: string;
  cameraApi: RefObject<CameraApi | null>;
  registry: RefObject<Map<string, THREE.Object3D>>;
  labels: RefObject<Map<string, HTMLDivElement>>;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  onStatus: (id: string, status: AgentLocation) => void;
};

/** Lugar na mesa geral: o orquestrador na cabeceira, os demais pela ordem das mesas. */
function seatOf(agent: Agent) {
  return agent.isOrchestrator ? 0 : (agent.deskIndex ?? 0) + 1;
}

export default function OfficeCanvas({
  agents,
  meetingIds,
  statuses,
  speeches,
  selectedId,
  dashboard,
  cortexLine,
  cameraApi,
  registry,
  labels,
  onSelect,
  onDeselect,
  onStatus,
}: Props) {
  // Ordem de saída: quem está mais perto da mesa geral sai primeiro.
  const order = [...agents]
    .filter((agent) => !agent.isOrchestrator)
    .sort((a, b) => (b.deskIndex ?? 0) % 5 - (a.deskIndex ?? 0) % 5 || (b.deskIndex ?? 0) - (a.deskIndex ?? 0))
    .map((agent) => agent.id);

  return (
    <Canvas
      // PCF simples: o three 0.186 não tem mais o PCFSoft, e o SoftShadows já suaviza as sombras.
      shadows="percentage"
      dpr={[1, 1.75]}
      camera={{ fov: 30, near: 0.1, far: 160, position: [...CAMERA_HOME.position] }}
      gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.02 }}
      onPointerMissed={(event) => {
        if (event.button === 0) onDeselect();
      }}
    >
      <color attach="background" args={[COLORS.background]} />
      <SoftShadows size={22} samples={12} focus={0.55} />
      <ambientLight intensity={0.5} />
      <hemisphereLight args={["#ffffff", "#e4d3bd", 0.75]} />
      <directionalLight
        castShadow
        position={[-9, 16, 10]}
        intensity={1.55}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={13}
        shadow-camera-bottom={-13}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
      />
      <directionalLight position={[12, 8, -4]} intensity={0.35} />
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={1.6} position={[0, 7, 9]} scale={[16, 6, 1]} />
        <Lightformer form="rect" intensity={0.9} position={[-10, 4, 0]} rotation-y={Math.PI / 2} scale={[12, 4, 1]} />
        <Lightformer form="rect" intensity={0.6} position={[10, 4, -2]} rotation-y={-Math.PI / 2} scale={[10, 4, 1]} />
      </Environment>

      <Suspense fallback={null}>
        <OfficeRoom dashboard={dashboard} cortexLine={cortexLine} />
      </Suspense>

      {agents.map((agent) => {
        const home = agent.isOrchestrator ? ORCHESTRATOR : deskHome(agent.deskIndex ?? 0);
        const position = order.indexOf(agent.id);
        return (
          <AgentActor
            key={agent.id}
            agent={agent}
            home={home}
            seat={seatOf(agent)}
            atMeeting={meetingIds.has(agent.id)}
            delay={agent.isOrchestrator ? 0.2 : 0.15 + Math.max(0, position) * 0.32}
            status={statuses[agent.id] ?? "desk"}
            selected={selectedId === agent.id}
            speech={speeches[agent.id] ?? null}
            registry={registry}
            onSelect={onSelect}
            onStatus={onStatus}
          />
        );
      })}

      <LabelProjector agents={agents} selectedId={selectedId} registry={registry} labels={labels} />
      <CameraRig apiRef={cameraApi} />
    </Canvas>
  );
}
