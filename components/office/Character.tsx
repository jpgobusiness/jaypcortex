"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { seeded, shade } from "@/components/office/palette";
import type { AgentAccessory, AgentAppearance, AgentHairStyle } from "@/lib/types";

/** Estado de animação que o AgentActor atualiza a cada quadro. */
export type Motion = {
  /** 1 = sentado, 0 = em pé. */
  sit: number;
  /** 0..1: intensidade do caminhar. */
  walk: number;
  /** Fase do ciclo de passos, em radianos. */
  phase: number;
  /** 0..1: digitando no notebook. */
  typing: number;
  /** 0..1: falando (balão aberto). */
  talk: number;
};

export function createMotion(sitting: boolean): Motion {
  return { sit: sitting ? 1 : 0, walk: 0, phase: 0, typing: sitting ? 1 : 0, talk: 0 };
}

/** Altura do quadril em pé (os pés ficam em y = 0). */
const HIP = 0.36;
/** Quanto o corpo sobe ao sentar: o assento das cadeiras fica a ~0,5 m. */
export const SIT_LIFT = 0.17;

function useCharacterMaterials(look: AgentAppearance) {
  const materials = useMemo(() => {
    const std = (color: string, roughness: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness, ...extra });
    return {
      skin: std(look.skinTone, 0.58),
      hair: std(look.hairColor, 0.7),
      brow: std(shade(look.hairColor, -0.15), 0.8),
      shirt: std(look.shirtColor, 0.78),
      shirtDark: std(shade(look.shirtColor, -0.22), 0.82),
      pants: std("#2c3240", 0.8),
      shoe: std("#f5f6f8", 0.45),
      eye: std("#121317", 0.22),
      shine: new THREE.MeshBasicMaterial({ color: "#ffffff" }),
      mouth: std("#6f2f2f", 0.6),
      cheek: std("#f08c8c", 0.9, { transparent: true, opacity: 0.42, depthWrite: false }),
      gear: std("#1d1f24", 0.45, { metalness: 0.25 }),
      lace: std("#ffffff", 0.6),
    };
  }, [look.skinTone, look.hairColor, look.shirtColor]);

  useEffect(
    () => () => {
      for (const material of Object.values(materials)) material.dispose();
    },
    [materials]
  );
  return materials;
}

type Materials = ReturnType<typeof useCharacterMaterials>;

/**
 * Personagem estilo "chibi" (cabeça grande), olhando para +z.
 * Pés em y = 0 quando em pé; o AgentActor move e gira o grupo de fora.
 */
export default function Character({
  appearance,
  motion,
  seed = 1,
}: {
  appearance: AgentAppearance;
  motion: RefObject<Motion>;
  seed?: number;
}) {
  const m = useCharacterMaterials(appearance);
  const root = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const arms = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const thighs = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const knees = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const blink = useRef({ next: 1.5 + (seed % 7) * 0.6, until: 0 });

  useFrame(({ clock }) => {
    const state = motion.current;
    if (!state || !root.current || !torso.current || !head.current) return;
    const t = clock.elapsedTime + seed * 1.37;
    const { sit, walk, phase, typing, talk } = state;
    const swing = Math.sin(phase);

    root.current.position.y = sit * SIT_LIFT + Math.abs(Math.sin(phase)) * 0.032 * walk;
    torso.current.rotation.x = 0.07 * walk;
    torso.current.rotation.z = swing * 0.03 * walk;
    torso.current.scale.y = 1 + Math.sin(t * 2.1) * 0.012 * (1 - walk);

    // Pernas: coxa gira no quadril, canela no joelho.
    thighs.forEach((thigh, index) => {
      const side = index === 0 ? 1 : -1;
      const knee = knees[index].current;
      if (!thigh.current || !knee) return;
      const step = swing * side;
      thigh.current.rotation.x = -sit * (Math.PI / 2 - 0.08) + step * 0.62 * walk;
      knee.rotation.x = sit * (Math.PI / 2 - 0.05) + Math.max(0, Math.sin(phase * side + 0.9)) * 0.75 * walk;
    });

    // Braços: balançam ao andar, vão para o teclado ao digitar.
    arms.forEach((arm, index) => {
      if (!arm.current) return;
      const side = index === 0 ? 1 : -1; // 0 = esquerdo (x negativo)
      const tap = Math.sin(t * 13 + index * Math.PI) * 0.07 * typing;
      arm.current.rotation.x = -swing * side * 0.55 * walk - typing * (1.2 + tap) + talk * Math.sin(t * 5 + index) * 0.08;
      arm.current.rotation.z = side * (-0.1 * (1 - typing) + 0.3 * typing);
    });

    // Cabeça: olha a tela ao digitar, acena ao falar, olha em volta parado.
    head.current.rotation.x = 0.1 * typing - 0.05 * talk + Math.sin(t * 9) * 0.035 * talk;
    head.current.rotation.y = Math.sin(t * 0.45) * 0.2 * (1 - walk) * (1 - typing * 0.6);
    head.current.position.y = 0.62 + Math.abs(Math.sin(phase)) * 0.01 * walk;

    if (mouth.current) {
      mouth.current.scale.y = 1 + (Math.sin(t * 15) * 0.5 + 0.5) * 1.3 * talk;
    }

    // Piscar a cada poucos segundos.
    const b = blink.current;
    if (t > b.next) {
      b.until = t + 0.12;
      b.next = t + 2.4 + ((seed * 13 + Math.floor(t)) % 7) * 0.45;
    }
    if (eyes.current) eyes.current.scale.y = t < b.until ? 0.12 : 1;
  });

  return (
    <group ref={root}>
      {[0, 1].map((index) => {
        const x = index === 0 ? -0.105 : 0.105;
        return (
          <group key={index} ref={thighs[index]} position={[x, HIP, 0]}>
            <mesh position={[0, -0.085, 0]} material={m.pants} castShadow>
              <capsuleGeometry args={[0.078, 0.05, 4, 12]} />
            </mesh>
            <group ref={knees[index]} position={[0, -0.165, 0]}>
              <mesh position={[0, -0.07, 0]} material={m.pants} castShadow>
                <capsuleGeometry args={[0.072, 0.05, 4, 12]} />
              </mesh>
              <RoundedBox args={[0.13, 0.075, 0.2]} radius={0.034} smoothness={2} position={[0, -0.158, 0.035]} material={m.shoe} castShadow />
            </group>
          </group>
        );
      })}

      <group ref={torso} position={[0, HIP, 0]}>
        <RoundedBox args={[0.47, 0.43, 0.31]} radius={0.125} smoothness={3} position={[0, 0.2, 0]} material={m.shirt} castShadow />
        <mesh position={[0, 0.405, -0.012]} rotation={[Math.PI / 2, 0, 0]} material={m.shirtDark} castShadow>
          <torusGeometry args={[0.13, 0.046, 10, 26]} />
        </mesh>
        {[-0.045, 0.045].map((x) => (
          <group key={x}>
            <mesh position={[x, 0.31, 0.158]} material={m.lace}>
              <cylinderGeometry args={[0.008, 0.008, 0.12, 6]} />
            </mesh>
            <mesh position={[x, 0.246, 0.16]} material={m.lace}>
              <sphereGeometry args={[0.014, 8, 6]} />
            </mesh>
          </group>
        ))}
        <RoundedBox args={[0.28, 0.09, 0.02]} radius={0.01} smoothness={2} position={[0, 0.075, 0.153]} material={m.shirtDark} />

        {[0, 1].map((index) => (
          <group key={index} ref={arms[index]} position={[index === 0 ? -0.265 : 0.265, 0.33, 0]}>
            <mesh position={[0, -0.11, 0]} material={m.shirt} castShadow>
              <capsuleGeometry args={[0.066, 0.12, 4, 12]} />
            </mesh>
            <mesh position={[0, -0.235, 0]} material={m.skin} castShadow>
              <sphereGeometry args={[0.063, 14, 10]} />
            </mesh>
          </group>
        ))}

        <group ref={head} position={[0, 0.62, 0]}>
          <mesh material={m.skin} scale={[1.04, 0.96, 1]} castShadow>
            <sphereGeometry args={[0.27, 36, 26]} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.272, -0.012, -0.005]} material={m.skin}>
              <sphereGeometry args={[0.055, 14, 10]} />
            </mesh>
          ))}
          <Face materials={m} eyes={eyes} mouth={mouth} />
          <Hair style={appearance.hairStyle} material={m.hair} seed={seed} />
          <Accessory kind={appearance.accessory} materials={m} />
        </group>
      </group>
    </group>
  );
}

function Face({
  materials: m,
  eyes,
  mouth,
}: {
  materials: Materials;
  eyes: RefObject<THREE.Group | null>;
  mouth: RefObject<THREE.Mesh | null>;
}) {
  return (
    <group>
      {/* Olhos grandes e brilhantes, saltados do rosto (aparecem de cima também). */}
      <group ref={eyes} position={[0, -0.02, 0]}>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.098, 0, 0.247]} rotation={[0, side * 0.32, 0]}>
            <mesh material={m.eye} scale={[0.82, 1.12, 0.62]}>
              <sphereGeometry args={[0.058, 20, 16]} />
            </mesh>
            <mesh position={[0.017, 0.03, 0.032]} material={m.shine}>
              <sphereGeometry args={[0.018, 10, 8]} />
            </mesh>
            <mesh position={[-0.014, -0.022, 0.034]} material={m.shine}>
              <sphereGeometry args={[0.008, 8, 6]} />
            </mesh>
          </group>
        ))}
      </group>
      {[-1, 1].map((side) => (
        <RoundedBox
          key={side}
          args={[0.074, 0.018, 0.02]}
          radius={0.008}
          smoothness={2}
          position={[side * 0.098, 0.07, 0.252]}
          rotation={[0, 0, side * -0.12]}
          material={m.brow}
        />
      ))}
      <mesh ref={mouth} position={[0, -0.108, 0.257]} rotation={[0.25, 0, Math.PI]} material={m.mouth}>
        <torusGeometry args={[0.03, 0.009, 6, 16, Math.PI]} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.168, -0.068, 0.216]} scale={[1, 0.62, 0.3]} material={m.cheek}>
          <sphereGeometry args={[0.042, 14, 10]} />
        </mesh>
      ))}
    </group>
  );
}

/** Calota de cabelo: um pedaço de esfera inclinado para trás (deixa a testa livre). */
function Cap({
  material,
  radius = 0.288,
  length = 1.72,
  tilt = -0.42,
}: {
  material: THREE.Material;
  radius?: number;
  length?: number;
  tilt?: number;
}) {
  return (
    <mesh position={[0, 0.03, -0.018]} rotation={[tilt, 0, 0]} material={material} castShadow>
      <sphereGeometry args={[radius, 36, 22, 0, Math.PI * 2, 0, length]} />
    </mesh>
  );
}

/** Pontos sobre a cabeça, para cachos e espetos. */
function useScalpPoints(count: number, seed: number, maxFront: number) {
  return useMemo(() => {
    const rand = seeded(seed);
    const points: { position: THREE.Vector3; normal: THREE.Vector3 }[] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count * 3 && points.length < count; i++) {
      const y = 1 - (i / (count * 3 - 1)) * 1.25;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const angle = i * golden + rand() * 0.3;
      const normal = new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r);
      if (normal.y < -0.12) continue;
      if (normal.z > maxFront && normal.y < 0.75) continue;
      points.push({ position: normal.clone().multiplyScalar(0.27), normal });
    }
    return points;
  }, [count, seed, maxFront]);
}

function Hair({ style, material, seed }: { style: AgentHairStyle; material: THREE.Material; seed: number }) {
  switch (style) {
    case "spiky":
      return <SpikyHair material={material} seed={seed} />;
    case "bob":
      return (
        <group>
          <Cap material={material} radius={0.3} length={1.85} tilt={-0.28} />
          {[-1, 1].map((side) => (
            <RoundedBox key={side} args={[0.1, 0.34, 0.33]} radius={0.045} smoothness={2} position={[side * 0.252, -0.095, -0.03]} material={material} castShadow />
          ))}
          <RoundedBox args={[0.5, 0.34, 0.12]} radius={0.05} smoothness={2} position={[0, -0.095, -0.205]} material={material} castShadow />
          <RoundedBox args={[0.44, 0.1, 0.13]} radius={0.045} smoothness={2} position={[0, 0.165, 0.205]} rotation={[0.48, 0, 0]} material={material} castShadow />
        </group>
      );
    case "curly":
      return <CurlyHair material={material} seed={seed} />;
    case "bun":
      return (
        <group>
          <Cap material={material} />
          <mesh position={[0, 0.27, -0.13]} material={material} castShadow>
            <sphereGeometry args={[0.11, 20, 16]} />
          </mesh>
        </group>
      );
    case "long":
      return (
        <group>
          <Cap material={material} radius={0.296} length={1.8} tilt={-0.3} />
          <RoundedBox args={[0.52, 0.48, 0.12]} radius={0.05} smoothness={2} position={[0, -0.17, -0.19]} material={material} castShadow />
          {[-1, 1].map((side) => (
            <RoundedBox key={side} args={[0.09, 0.42, 0.15]} radius={0.04} smoothness={2} position={[side * 0.25, -0.14, -0.03]} material={material} castShadow />
          ))}
        </group>
      );
    case "beanie":
      return (
        <group rotation={[-0.2, 0, 0]}>
          <mesh position={[0, 0.03, -0.01]} material={material} castShadow>
            <sphereGeometry args={[0.3, 36, 20, 0, Math.PI * 2, 0, 1.5]} />
          </mesh>
          <mesh position={[0, 0.045, -0.01]} rotation={[Math.PI / 2, 0, 0]} material={material} castShadow>
            <torusGeometry args={[0.288, 0.05, 12, 40]} />
          </mesh>
          <mesh position={[0, 0.34, -0.01]} material={material} castShadow>
            <sphereGeometry args={[0.06, 14, 10]} />
          </mesh>
        </group>
      );
    case "short":
    default:
      return <Cap material={material} />;
  }
}

function SpikyHair({ material, seed }: { material: THREE.Material; seed: number }) {
  const points = useScalpPoints(11, seed + 3, -0.05);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  return (
    <group>
      <Cap material={material} />
      {points.map((point, index) => {
        const quaternion = new THREE.Quaternion().setFromUnitVectors(up, point.normal);
        return (
          <mesh
            key={index}
            position={point.position.clone().multiplyScalar(1.02)}
            quaternion={quaternion}
            material={material}
            castShadow
          >
            <coneGeometry args={[0.062, 0.2, 6]} />
          </mesh>
        );
      })}
    </group>
  );
}

function CurlyHair({ material, seed }: { material: THREE.Material; seed: number }) {
  const points = useScalpPoints(24, seed + 9, 0.05);
  return (
    <group>
      <Cap material={material} radius={0.29} />
      {points.map((point, index) => (
        <mesh key={index} position={point.position.clone().multiplyScalar(1.05)} material={material} castShadow>
          <sphereGeometry args={[0.1 + (index % 3) * 0.012, 14, 10]} />
        </mesh>
      ))}
    </group>
  );
}

function Accessory({ kind, materials: m }: { kind: AgentAccessory; materials: Materials }) {
  if (kind === "headphones") {
    return (
      <group position={[0, 0, -0.02]}>
        <mesh material={m.gear} castShadow>
          <torusGeometry args={[0.312, 0.022, 8, 36, Math.PI]} />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.3, -0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
            <mesh material={m.gear} castShadow>
              <cylinderGeometry args={[0.085, 0.085, 0.075, 22]} />
            </mesh>
            <mesh position={[0, side * 0.04, 0]} material={m.shirt}>
              <cylinderGeometry args={[0.05, 0.05, 0.01, 18]} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }
  if (kind === "glasses") {
    return (
      <group position={[0, -0.012, 0]}>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.098, 0, 0.262]} material={m.gear}>
            <torusGeometry args={[0.058, 0.011, 8, 26]} />
          </mesh>
        ))}
        <mesh position={[0, 0.006, 0.266]} material={m.gear}>
          <boxGeometry args={[0.06, 0.012, 0.012]} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.2, 0, 0.15]} rotation={[0, side * 0.32, 0]} material={m.gear}>
            <boxGeometry args={[0.012, 0.012, 0.22]} />
          </mesh>
        ))}
      </group>
    );
  }
  return null;
}
