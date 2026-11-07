"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import Character, { createMotion } from "@/components/office/Character";
import Robot from "@/components/office/Robot";
import type { AgentAppearance } from "@/lib/types";

function Turntable({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.6;
  });
  return <group ref={group}>{children}</group>;
}

/** Prévia 3D do agente girando, usada no formulário. */
export default function AvatarPreview({
  appearance,
  robot = false,
}: {
  appearance: AgentAppearance;
  robot?: boolean;
}) {
  const motion = useRef(createMotion(false));
  return (
    <Canvas
      // Mesmo tipo de sombra do escritório (o three 0.186 não tem mais o PCFSoft).
      shadows="percentage"
      dpr={[1, 2]}
      camera={{ fov: 28, position: [0, 1.25, 3.4] }}
      gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping }}
      onCreated={({ camera }) => camera.lookAt(0, 0.68, 0)}
    >
      <ambientLight intensity={0.8} />
      <hemisphereLight args={["#ffffff", "#e9dccb", 0.7]} />
      <directionalLight castShadow position={[-2, 4, 3]} intensity={1.4} shadow-mapSize={[1024, 1024]} />
      <Turntable>{robot ? <Robot motion={motion} /> : <Character appearance={appearance} motion={motion} seed={3} />}</Turntable>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.85, 48]} />
        <meshStandardMaterial color="#eef0f3" roughness={0.9} />
      </mesh>
    </Canvas>
  );
}
