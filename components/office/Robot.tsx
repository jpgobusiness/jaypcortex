"use client";

import { useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { COLORS } from "@/components/office/palette";
import type { Motion } from "@/components/office/Character";

/**
 * Cortex, o orquestrador: robô branco flutuante com um anel de luz em volta
 * da cabeça (no vídeo de referência é o "Neon", com anel laranja).
 */
export default function Robot({ motion }: { motion: RefObject<Motion> }) {
  const body = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Mesh>(null);
  const blink = useRef({ next: 2, until: 0 });

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const state = motion.current;
    const walk = state?.walk ?? 0;
    const talk = state?.talk ?? 0;
    if (body.current) {
      body.current.position.y = 0.2 + Math.sin(t * 2.2) * 0.045;
      body.current.rotation.x = 0.16 * walk;
      body.current.rotation.z = Math.sin(t * 1.3) * 0.03;
    }
    if (ring.current) ring.current.rotation.y += delta * (0.8 + talk * 1.6);
    if (halo.current) {
      const pulse = 1 + Math.sin(t * 2.2) * 0.06;
      halo.current.scale.set(pulse, pulse, pulse);
    }
    const b = blink.current;
    if (t > b.next) {
      b.until = t + 0.12;
      b.next = t + 3 + (Math.floor(t) % 3);
    }
    if (eyes.current) {
      const open = t < b.until ? 0.15 : 1 + Math.sin(t * 12) * 0.12 * talk;
      eyes.current.scale.y = open;
    }
  });

  return (
    <group>
      <mesh ref={halo} position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.32, 0.42, 48]} />
        <meshBasicMaterial color={COLORS.cyan} transparent opacity={0.45} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.011, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.3, 40]} />
        <meshBasicMaterial color={COLORS.cyan} transparent opacity={0.12} toneMapped={false} />
      </mesh>

      <group ref={body}>
        <mesh position={[0, 0.44, 0]} castShadow>
          <capsuleGeometry args={[0.19, 0.16, 8, 18]} />
          <meshStandardMaterial color="#f6f8fb" roughness={0.22} metalness={0.05} />
        </mesh>
        <mesh position={[0, 0.47, 0.188]}>
          <circleGeometry args={[0.05, 24]} />
          <meshBasicMaterial color={COLORS.brandSoft} toneMapped={false} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.24, 0.45, 0]} castShadow>
            <sphereGeometry args={[0.075, 16, 12]} />
            <meshStandardMaterial color="#e9edf3" roughness={0.3} />
          </mesh>
        ))}

        <group position={[0, 0.9, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.33, 40, 28]} />
            <meshStandardMaterial color="#fafbfd" roughness={0.18} metalness={0.05} />
          </mesh>
          <mesh position={[0, 0.0, 0.2]} scale={[1, 0.66, 0.62]}>
            <sphereGeometry args={[0.27, 36, 24]} />
            <meshStandardMaterial color="#0c1122" roughness={0.12} metalness={0.35} />
          </mesh>
          <group ref={eyes} position={[0, 0.012, 0]}>
            {[-1, 1].map((side) => (
              <mesh key={side} position={[side * 0.085, 0, 0.352]}>
                <capsuleGeometry args={[0.028, 0.045, 4, 10]} />
                <meshBasicMaterial color="#67e8f9" toneMapped={false} />
              </mesh>
            ))}
          </group>
          <mesh position={[0, -0.085, 0.345]} rotation={[0.2, 0, Math.PI]}>
            <torusGeometry args={[0.04, 0.008, 6, 16, Math.PI]} />
            <meshBasicMaterial color="#67e8f9" toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.36, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.09, 8]} />
            <meshStandardMaterial color="#cfd5df" />
          </mesh>
          <mesh position={[0, 0.42, 0]}>
            <sphereGeometry args={[0.035, 14, 10]} />
            <meshBasicMaterial color={COLORS.brandSoft} toneMapped={false} />
          </mesh>
          <group ref={ring} rotation={[0, 0, 0]}>
            <mesh rotation={[1.22, 0, 0.32]}>
              <torusGeometry args={[0.5, 0.026, 12, 72]} />
              <meshBasicMaterial color={COLORS.brand} toneMapped={false} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}
