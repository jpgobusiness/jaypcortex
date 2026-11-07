"use client";

import { useMemo, useRef } from "react";
import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { COLORS, seeded } from "@/components/office/palette";
import { DESK_TOP, type Pose, type Vec2 } from "@/components/office/layout";

type At = { position: Vec2; rotation?: number };

/* ---------------- Mesa de trabalho ---------------- */

export function Desk({ position, plant = false, seed = 1 }: At & { plant?: boolean; seed?: number }) {
  return (
    <group position={[position.x, 0, position.z]}>
      <RoundedBox
        args={[1.45, 0.07, 0.72]}
        radius={0.025}
        smoothness={3}
        position={[0, DESK_TOP - 0.035, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={COLORS.white} roughness={0.45} />
      </RoundedBox>
      {[-0.66, 0.66].map((x) => (
        <mesh key={x} position={[x, (DESK_TOP - 0.07) / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.05, DESK_TOP - 0.07, 0.64]} />
          <meshStandardMaterial color={COLORS.white} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 0.48, 0.3]} castShadow receiveShadow>
        <boxGeometry args={[1.28, 0.36, 0.03]} />
        <meshStandardMaterial color={COLORS.offWhite} roughness={0.55} />
      </mesh>
      <Laptop position={{ x: 0, z: -0.04 }} />
      <Phone position={{ x: 0.5, z: -0.14 }} rotation={0.35} />
      <Mug position={{ x: -0.52, z: -0.16 }} />
      {plant && <MiniPlant position={{ x: 0.52, z: 0.18 }} seed={seed} />}
    </group>
  );
}

/** Notebook virado para o agente (sentado em -z); a tampa fica para a câmera. */
export function Laptop({ position, rotation = 0, y = DESK_TOP }: At & { y?: number }) {
  return (
    <group position={[position.x, y, position.z]} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.009, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.44, 0.018, 0.3]} />
        <meshStandardMaterial color="#7d848e" roughness={0.35} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.019, -0.03]}>
        <boxGeometry args={[0.38, 0.003, 0.16]} />
        <meshStandardMaterial color="#2b2f36" roughness={0.6} />
      </mesh>
      <group position={[0, 0.018, 0.145]} rotation={[0.24, 0, 0]}>
        <mesh position={[0, 0.135, 0]} castShadow>
          <boxGeometry args={[0.44, 0.27, 0.014]} />
          <meshStandardMaterial color="#8d949e" roughness={0.32} metalness={0.55} />
        </mesh>
        {/* Tela, do lado do agente. */}
        <mesh position={[0, 0.138, -0.008]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[0.4, 0.23]} />
          <meshStandardMaterial color="#1f2a44" emissive="#3c5a8f" emissiveIntensity={0.55} roughness={0.3} />
        </mesh>
        {/* Logo na tampa. */}
        <mesh position={[0, 0.15, 0.0075]}>
          <circleGeometry args={[0.028, 24]} />
          <meshStandardMaterial color={COLORS.brandSoft} emissive={COLORS.brand} emissiveIntensity={0.6} />
        </mesh>
      </group>
    </group>
  );
}

function Phone({ position, rotation = 0 }: At) {
  return (
    <group position={[position.x, DESK_TOP, position.z]} rotation={[0, rotation, 0]}>
      <RoundedBox args={[0.085, 0.012, 0.16]} radius={0.005} smoothness={2} position={[0, 0.006, 0]} castShadow>
        <meshStandardMaterial color="#17191d" roughness={0.3} metalness={0.3} />
      </RoundedBox>
      <mesh position={[0, 0.0125, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.074, 0.145]} />
        <meshStandardMaterial color="#1c2333" emissive="#2d3c63" emissiveIntensity={0.35} />
      </mesh>
    </group>
  );
}

function Mug({ position }: At) {
  return (
    <group position={[position.x, DESK_TOP, position.z]}>
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.042, 0.038, 0.1, 18]} />
        <meshStandardMaterial color="#fbfbfc" roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.0435, 0.0435, 0.032, 18]} />
        <meshStandardMaterial color={COLORS.brand} roughness={0.5} />
      </mesh>
    </group>
  );
}

/* ---------------- Cadeira ---------------- */

export function OfficeChair({ pose }: { pose: Pose }) {
  return (
    <group position={[pose.x, 0, pose.z]} rotation={[0, pose.rotation, 0]}>
      <RoundedBox args={[0.5, 0.08, 0.48]} radius={0.035} smoothness={2} position={[0, 0.46, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={COLORS.black} roughness={0.55} />
      </RoundedBox>
      <RoundedBox
        args={[0.48, 0.56, 0.07]}
        radius={0.035}
        smoothness={2}
        position={[0, 0.8, -0.24]}
        rotation={[-0.1, 0, 0]}
        castShadow
      >
        <meshStandardMaterial color={COLORS.black} roughness={0.55} />
      </RoundedBox>
      <mesh position={[0, 0.27, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.34, 10]} />
        <meshStandardMaterial color={COLORS.steel} metalness={0.5} roughness={0.35} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => {
        const angle = (i / 5) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.sin(angle) * 0.13, 0.05, Math.cos(angle) * 0.13]}
            rotation={[0, angle, 0]}
            castShadow
          >
            <boxGeometry args={[0.05, 0.035, 0.27]} />
            <meshStandardMaterial color={COLORS.steel} metalness={0.4} roughness={0.4} />
          </mesh>
        );
      })}
    </group>
  );
}

/* ---------------- Plantas ---------------- */

function useFoliage(seed: number, count: number, spread: number, height: number, size: number) {
  return useMemo(() => {
    const rand = seeded(seed);
    return Array.from({ length: count }, () => ({
      position: [
        (rand() - 0.5) * spread,
        height + rand() * size * 1.4,
        (rand() - 0.5) * spread,
      ] as [number, number, number],
      radius: size * (0.75 + rand() * 0.45),
      color: COLORS.plants[Math.floor(rand() * COLORS.plants.length)],
    }));
  }, [seed, count, spread, height, size]);
}

export function Plant({ position, scale = 1, seed = 1 }: At & { scale?: number; seed?: number }) {
  const leaves = useFoliage(seed, 8, 0.42, 0.62, 0.19);
  return (
    <group position={[position.x, 0, position.z]} scale={scale}>
      <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.21, 0.17, 0.44, 22]} />
        <meshStandardMaterial color="#f4f4f1" roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.43, 0]}>
        <cylinderGeometry args={[0.19, 0.19, 0.02, 22]} />
        <meshStandardMaterial color="#5a3f2b" roughness={0.9} />
      </mesh>
      {leaves.map((leaf, index) => (
        <mesh key={index} position={leaf.position} castShadow>
          <icosahedronGeometry args={[leaf.radius, 1]} />
          <meshStandardMaterial color={leaf.color} roughness={0.75} flatShading />
        </mesh>
      ))}
    </group>
  );
}

function MiniPlant({ position, seed = 1 }: At & { seed?: number }) {
  const leaves = useFoliage(seed + 40, 4, 0.08, 0.13, 0.055);
  return (
    <group position={[position.x, DESK_TOP, position.z]}>
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.04, 0.1, 16]} />
        <meshStandardMaterial color="#f7f7f5" roughness={0.45} />
      </mesh>
      {leaves.map((leaf, index) => (
        <mesh key={index} position={leaf.position} castShadow>
          <icosahedronGeometry args={[leaf.radius, 1]} />
          <meshStandardMaterial color={leaf.color} roughness={0.75} flatShading />
        </mesh>
      ))}
    </group>
  );
}

/* ---------------- Lounge ---------------- */

export function RoundRug({ position, radius, color = COLORS.rug }: At & { radius: number; color?: string }) {
  return (
    <mesh position={[position.x, 0.008, position.z]} receiveShadow>
      <cylinderGeometry args={[radius, radius, 0.016, 72]} />
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
  );
}

export function Sofa({ position, rotation = 0 }: At) {
  const fabric = <meshStandardMaterial color={COLORS.charcoal} roughness={0.85} />;
  return (
    <group position={[position.x, 0, position.z]} rotation={[0, rotation, 0]}>
      <RoundedBox args={[2.5, 0.42, 1.0]} radius={0.09} smoothness={3} position={[0, 0.27, 0]} castShadow receiveShadow>
        {fabric}
      </RoundedBox>
      <RoundedBox args={[2.5, 0.62, 0.26]} radius={0.1} smoothness={3} position={[0, 0.62, -0.42]} castShadow>
        {fabric}
      </RoundedBox>
      {[-1.16, 1.16].map((x) => (
        <RoundedBox key={x} args={[0.24, 0.58, 1.0]} radius={0.09} smoothness={3} position={[x, 0.42, 0]} castShadow>
          {fabric}
        </RoundedBox>
      ))}
      <RoundedBox args={[1.08, 0.12, 0.72]} radius={0.05} smoothness={2} position={[-0.52, 0.53, 0.08]} castShadow>
        <meshStandardMaterial color="#383b42" roughness={0.9} />
      </RoundedBox>
      <RoundedBox args={[1.08, 0.12, 0.72]} radius={0.05} smoothness={2} position={[0.54, 0.53, 0.08]} castShadow>
        <meshStandardMaterial color="#383b42" roughness={0.9} />
      </RoundedBox>
      <RoundedBox args={[0.42, 0.38, 0.14]} radius={0.06} smoothness={2} position={[0.72, 0.78, -0.24]} rotation={[-0.25, 0.15, 0.05]} castShadow>
        <meshStandardMaterial color="#e5533d" roughness={0.8} />
      </RoundedBox>
      <RoundedBox args={[0.42, 0.38, 0.14]} radius={0.06} smoothness={2} position={[-0.74, 0.78, -0.24]} rotation={[-0.25, -0.15, -0.05]} castShadow>
        <meshStandardMaterial color="#f4f4f2" roughness={0.8} />
      </RoundedBox>
    </group>
  );
}

export function CoffeeTable({ position }: At) {
  return (
    <group position={[position.x, 0, position.z]}>
      <mesh position={[0, 0.36, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.5, 0.5, 0.05, 40]} />
        <meshStandardMaterial color={COLORS.white} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.17, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.12, 0.34, 16]} />
        <meshStandardMaterial color={COLORS.white} roughness={0.4} />
      </mesh>
      <mesh position={[0.12, 0.43, 0.05]} castShadow>
        <cylinderGeometry args={[0.05, 0.045, 0.09, 16]} />
        <meshStandardMaterial color="#e5533d" roughness={0.45} />
      </mesh>
      <mesh position={[-0.14, 0.395, -0.06]} rotation={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[0.28, 0.02, 0.2]} />
        <meshStandardMaterial color="#d7dbe2" roughness={0.6} />
      </mesh>
    </group>
  );
}

/* ---------------- Mesa geral ---------------- */

export function MeetingTable({ position, radius }: At & { radius: number }) {
  return (
    <group position={[position.x, 0, position.z]}>
      <mesh position={[0, 0.725, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, 0.07, 72]} />
        <meshStandardMaterial color={COLORS.white} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.36, 0]} castShadow>
        <cylinderGeometry args={[0.42, 0.6, 0.66, 32]} />
        <meshStandardMaterial color={COLORS.offWhite} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.765, 0]}>
        <cylinderGeometry args={[0.6, 0.6, 0.012, 48]} />
        <meshStandardMaterial color="#1b2130" roughness={0.2} metalness={0.4} />
      </mesh>
      <Hologram />
    </group>
  );
}

/** Barras holográficas no centro da mesa geral, subindo e descendo devagar. */
function Hologram() {
  const bars = useRef<(THREE.Mesh | null)[]>([]);
  const layout = useMemo(() => {
    const rand = seeded(5);
    return COLORS.holo.map((color, index) => {
      const angle = (index / COLORS.holo.length) * Math.PI * 2;
      const ring = index % 2 === 0 ? 0.16 : 0.3;
      return {
        color,
        x: Math.sin(angle) * ring,
        z: Math.cos(angle) * ring,
        height: 0.45 + rand() * 0.55,
        speed: 0.6 + rand() * 0.8,
        offset: rand() * Math.PI * 2,
      };
    });
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    layout.forEach((bar, index) => {
      const mesh = bars.current[index];
      if (!mesh) return;
      const scale = 0.75 + 0.25 * Math.sin(t * bar.speed + bar.offset);
      mesh.scale.y = scale;
      mesh.position.y = 0.78 + (bar.height * scale) / 2;
    });
  });

  return (
    <group>
      {layout.map((bar, index) => (
        <mesh
          key={index}
          ref={(mesh) => {
            bars.current[index] = mesh;
          }}
          position={[bar.x, 0.78 + bar.height / 2, bar.z]}
        >
          <boxGeometry args={[0.11, bar.height, 0.11]} />
          <meshStandardMaterial
            color={bar.color}
            emissive={bar.color}
            emissiveIntensity={0.55}
            transparent
            opacity={0.9}
            roughness={0.25}
          />
        </mesh>
      ))}
      <mesh position={[0, 0.775, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.44, 0.5, 48]} />
        <meshBasicMaterial color={COLORS.cyan} transparent opacity={0.55} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Tablet na mesa geral, na frente de um lugar. */
export function Tablet({ pose, tableY = 0.76 }: { pose: Pose; tableY?: number }) {
  return (
    <group position={[pose.x, tableY, pose.z]} rotation={[0, pose.rotation, 0]}>
      <group rotation={[-1.15, 0, 0]} position={[0, 0.08, 0]}>
        <RoundedBox args={[0.3, 0.2, 0.016]} radius={0.01} smoothness={2} castShadow>
          <meshStandardMaterial color="#17191e" roughness={0.3} metalness={0.3} />
        </RoundedBox>
        <mesh position={[0, 0, 0.009]}>
          <planeGeometry args={[0.27, 0.17]} />
          <meshStandardMaterial color="#3b2a7a" emissive="#7c5cff" emissiveIntensity={0.7} />
        </mesh>
      </group>
    </group>
  );
}

/* ---------------- Paredes e decoração ---------------- */

/** Janela na parede da esquerda (virada para +x). */
export function WallWindow({ z, y = 1.7, width = 2.3, height = 1.7, wallX }: { z: number; y?: number; width?: number; height?: number; wallX: number }) {
  const frame = <meshStandardMaterial color="#fbfbfc" roughness={0.4} />;
  const x = wallX + 0.005;
  return (
    <group position={[x, y, z]}>
      <mesh position={[0.012, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color="#cfe5f6" emissive="#dff0ff" emissiveIntensity={0.55} roughness={0.15} />
      </mesh>
      {[
        { p: [0.03, height / 2, 0], s: [0.06, 0.08, width + 0.08] },
        { p: [0.03, -height / 2, 0], s: [0.06, 0.08, width + 0.08] },
        { p: [0.03, 0, width / 2], s: [0.06, height, 0.08] },
        { p: [0.03, 0, -width / 2], s: [0.06, height, 0.08] },
        { p: [0.03, 0, 0], s: [0.05, height, 0.05] },
        { p: [0.03, height * 0.12, 0], s: [0.05, 0.05, width] },
      ].map((bar, index) => (
        <mesh key={index} position={bar.p as [number, number, number]}>
          <boxGeometry args={bar.s as [number, number, number]} />
          {frame}
        </mesh>
      ))}
      <mesh position={[0.08, -height / 2 - 0.05, 0]} castShadow>
        <boxGeometry args={[0.16, 0.04, width + 0.2]} />
        {frame}
      </mesh>
    </group>
  );
}

/** Luminária pendente preta, como as do vídeo. */
export function PendantLamp({ position, drop = 0.9 }: At & { drop?: number }) {
  const top = 3.4;
  const shadeY = top - drop;
  return (
    <group position={[position.x, 0, position.z]}>
      <mesh position={[0, (top + shadeY) / 2, 0]}>
        <cylinderGeometry args={[0.006, 0.006, top - shadeY, 6]} />
        <meshStandardMaterial color="#15161a" />
      </mesh>
      <mesh position={[0, shadeY - 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.3, 0.22, 28, 1, true]} />
        <meshStandardMaterial color="#1a1c20" roughness={0.45} metalness={0.3} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, shadeY - 0.19, 0]}>
        <sphereGeometry args={[0.07, 16, 12]} />
        <meshStandardMaterial color="#fff4d6" emissive="#ffe7a8" emissiveIntensity={1.4} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Relógio de parede com a hora real. */
export function WallClock({ position, y }: At & { y: number }) {
  const hour = useRef<THREE.Group>(null);
  const minute = useRef<THREE.Group>(null);
  useFrame(() => {
    const now = new Date();
    const minutes = now.getMinutes() + now.getSeconds() / 60;
    const hours = (now.getHours() % 12) + minutes / 60;
    if (minute.current) minute.current.rotation.z = -(minutes / 60) * Math.PI * 2;
    if (hour.current) hour.current.rotation.z = -(hours / 12) * Math.PI * 2;
  });
  return (
    <group position={[position.x, y, position.z]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.34, 0.34, 0.05, 40]} />
        <meshStandardMaterial color="#fdfdfd" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.026]}>
        <torusGeometry args={[0.33, 0.025, 10, 48]} />
        <meshStandardMaterial color="#1c1d21" roughness={0.4} />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.sin(angle) * 0.27, Math.cos(angle) * 0.27, 0.03]} rotation={[0, 0, -angle]}>
            <boxGeometry args={[0.015, i % 3 === 0 ? 0.06 : 0.035, 0.005]} />
            <meshStandardMaterial color="#2a2c31" />
          </mesh>
        );
      })}
      {/* Ponteiros: o grupo gira no centro e a haste sai dele para cima. */}
      <group ref={hour} position={[0, 0, 0.036]}>
        <mesh position={[0, 0.07, 0]}>
          <boxGeometry args={[0.024, 0.17, 0.006]} />
          <meshStandardMaterial color="#1c1d21" />
        </mesh>
      </group>
      <group ref={minute} position={[0, 0, 0.042]}>
        <mesh position={[0, 0.11, 0]}>
          <boxGeometry args={[0.015, 0.25, 0.006]} />
          <meshStandardMaterial color="#1c1d21" />
        </mesh>
      </group>
      <mesh position={[0, 0, 0.046]}>
        <circleGeometry args={[0.022, 16]} />
        <meshStandardMaterial color={COLORS.brand} />
      </mesh>
    </group>
  );
}

/** TV de parede com uma textura de canvas (painel). */
export function WallTv({
  position,
  y,
  width,
  height,
  texture,
}: At & { y: number; width: number; height: number; texture: THREE.Texture }) {
  return (
    <group position={[position.x, y, position.z]}>
      <RoundedBox args={[width + 0.14, height + 0.14, 0.09]} radius={0.03} smoothness={2} castShadow>
        <meshStandardMaterial color="#121418" roughness={0.35} metalness={0.3} />
      </RoundedBox>
      <mesh position={[0, 0, 0.047]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ---------------- Sala de vidro ---------------- */

type Segment = { from: Vec2; to: Vec2 };

/** Parede de vidro com caixilho preto, entre dois pontos no chão. */
export function GlassWall({ from, to, height = 2.45 }: Segment & { height?: number }) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz) - Math.PI / 2;
  const mid = { x: (from.x + to.x) / 2, z: (from.z + to.z) / 2 };
  const posts = Math.max(1, Math.round(length / 1.6));
  return (
    <group position={[mid.x, 0, mid.z]} rotation={[0, angle, 0]}>
      <mesh position={[0, height / 2, 0]} renderOrder={2}>
        <boxGeometry args={[length, height, 0.025]} />
        <meshStandardMaterial
          color={COLORS.glass}
          transparent
          opacity={0.2}
          roughness={0.05}
          metalness={0.1}
          depthWrite={false}
        />
      </mesh>
      {[height, 0.03].map((barY) => (
        <mesh key={barY} position={[0, barY, 0]} castShadow>
          <boxGeometry args={[length + 0.06, 0.06, 0.06]} />
          <meshStandardMaterial color="#1b1d21" roughness={0.4} metalness={0.4} />
        </mesh>
      ))}
      {Array.from({ length: posts + 1 }, (_, i) => (
        <mesh key={i} position={[-length / 2 + (length * i) / posts, height / 2, 0]} castShadow>
          <boxGeometry args={[0.055, height, 0.055]} />
          <meshStandardMaterial color="#1b1d21" roughness={0.4} metalness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

/** Mesa do orquestrador, com monitor virado para ele. */
export function CortexDesk({ position }: At) {
  return (
    <group position={[position.x, 0, position.z]}>
      <RoundedBox args={[2.0, 0.07, 0.8]} radius={0.025} smoothness={3} position={[0, DESK_TOP - 0.035, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={COLORS.charcoal} roughness={0.45} />
      </RoundedBox>
      {[-0.92, 0.92].map((x) => (
        <mesh key={x} position={[x, (DESK_TOP - 0.07) / 2, 0]} castShadow>
          <boxGeometry args={[0.06, DESK_TOP - 0.07, 0.7]} />
          <meshStandardMaterial color={COLORS.charcoal} roughness={0.5} />
        </mesh>
      ))}
      {/* Monitor no canto da mesa, virado para o orquestrador sem escondê-lo. */}
      <group position={[0.62, DESK_TOP, 0.1]} rotation={[0, -0.55, 0]}>
        <mesh position={[0, 0.13, 0]} castShadow>
          <boxGeometry args={[0.05, 0.26, 0.05]} />
          <meshStandardMaterial color="#2b2e35" metalness={0.5} roughness={0.4} />
        </mesh>
        <RoundedBox args={[0.74, 0.44, 0.045]} radius={0.02} smoothness={2} position={[0, 0.42, 0]} castShadow>
          <meshStandardMaterial color="#15171b" roughness={0.3} metalness={0.3} />
        </RoundedBox>
        <mesh position={[0, 0.42, -0.025]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[0.68, 0.38]} />
          <meshStandardMaterial color="#1a2140" emissive="#3a54b5" emissiveIntensity={0.6} />
        </mesh>
      </group>
      <Laptop position={{ x: -0.5, z: -0.06 }} rotation={0.3} />
    </group>
  );
}
