"use client";

import { Suspense, useEffect, useMemo } from "react";
import { RoundedBox, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { COLORS } from "@/components/office/palette";
import {
  createCanvasTexture,
  createWoodTexture,
  paintCortexScreen,
  paintDashboard,
  prepareImageTexture,
  type DashboardData,
} from "@/components/office/textures";
import {
  CoffeeTable,
  CortexDesk,
  Desk,
  GlassWall,
  MeetingTable,
  OfficeChair,
  PendantLamp,
  Plant,
  RoundRug,
  Sofa,
  Tablet,
  WallClock,
  WallTv,
  WallWindow,
} from "@/components/office/Furniture";
import {
  DESKS,
  DESK_RUG,
  FLOOR,
  GLASS_ROOM,
  MEETING,
  WALL_HEIGHT,
  deskSeat,
  meetingChair,
  meetingSeatAngle,
} from "@/components/office/layout";

const BACK_Z = FLOOR.minZ;
const LEFT_X = FLOOR.minX;

type Props = {
  dashboard: DashboardData;
  cortexLine: string;
};

/** O escritório sem os agentes: piso, paredes, móveis e telas. */
export default function OfficeRoom({ dashboard, cortexLine }: Props) {
  const wood = useMemo(() => {
    const texture = createWoodTexture();
    texture.repeat.set((FLOOR.maxX - FLOOR.minX) / 1.7, (FLOOR.maxZ - FLOOR.minZ) / 1.7);
    return texture;
  }, []);
  useEffect(() => () => wood.dispose(), [wood]);

  const floorMaterials = useMemo(() => {
    const side = new THREE.MeshStandardMaterial({ color: COLORS.woodEdge, roughness: 0.75 });
    const top = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.62 });
    return [side, side, top, side, side, side];
  }, [wood]);

  const tv = useMemo(() => createCanvasTexture(1024, 444), []);
  const cortexTv = useMemo(() => createCanvasTexture(768, 432), []);
  useEffect(() => paintDashboard(tv, dashboard), [tv, dashboard]);
  useEffect(() => paintCortexScreen(cortexTv, cortexLine), [cortexTv, cortexLine]);
  useEffect(
    () => () => {
      tv.texture.dispose();
      cortexTv.texture.dispose();
    },
    [tv, cortexTv]
  );

  const width = FLOOR.maxX - FLOOR.minX;
  const depth = FLOOR.maxZ - FLOOR.minZ;
  const rugWidth = DESK_RUG.maxX - DESK_RUG.minX;
  const rugDepth = DESK_RUG.maxZ - DESK_RUG.minZ;
  const glassWidth = GLASS_ROOM.maxX - GLASS_ROOM.minX;
  const glassDepth = GLASS_ROOM.maxZ - GLASS_ROOM.minZ;

  return (
    <group>
      {/* Piso (laje com borda visível, como uma maquete). */}
      <mesh position={[0, -FLOOR.thickness / 2, 0]} material={floorMaterials} receiveShadow>
        <boxGeometry args={[width, FLOOR.thickness, depth]} />
      </mesh>

      {/* Paredes do fundo e da esquerda. */}
      <mesh position={[0, WALL_HEIGHT / 2, BACK_Z - 0.11]} receiveShadow>
        <boxGeometry args={[width + 0.44, WALL_HEIGHT, 0.22]} />
        <meshStandardMaterial color={COLORS.wall} roughness={0.9} />
      </mesh>
      <mesh position={[LEFT_X - 0.11, WALL_HEIGHT / 2, 0]} receiveShadow>
        <boxGeometry args={[0.22, WALL_HEIGHT, depth]} />
        <meshStandardMaterial color={COLORS.wall} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.05, BACK_Z + 0.015]}>
        <boxGeometry args={[width, 0.1, 0.03]} />
        <meshStandardMaterial color={COLORS.baseboard} />
      </mesh>
      <mesh position={[LEFT_X + 0.015, 0.05, 0]}>
        <boxGeometry args={[0.03, 0.1, depth]} />
        <meshStandardMaterial color={COLORS.baseboard} />
      </mesh>

      {/* Parede verde-sálvia atrás da TV. */}
      <mesh position={[-2.5, WALL_HEIGHT / 2, BACK_Z + 0.02]} receiveShadow>
        <boxGeometry args={[7.8, WALL_HEIGHT, 0.04]} />
        <meshStandardMaterial color={COLORS.sage} roughness={0.9} />
      </mesh>
      <WallTv position={{ x: -2.5, z: BACK_Z + 0.09 }} y={1.95} width={5.2} height={2.25} texture={tv.texture} />
      <WallClock position={{ x: 2.45, z: BACK_Z + 0.05 }} y={2.25} />

      <WallWindow wallX={LEFT_X} z={-4.3} />
      <WallWindow wallX={LEFT_X} z={-1.1} />
      <Suspense fallback={null}>
        <WallLogo />
      </Suspense>

      {[-7.6, -6.2, 1.15, 2.55].map((x) => (
        <PendantLamp key={x} position={{ x, z: -5.7 }} drop={x > 0 ? 1.05 : 0.9} />
      ))}

      {/* Aparador com caixa de som, no canto do fundo. */}
      <group position={[-9.2, 0, BACK_Z + 0.45]}>
        <RoundedBox args={[1.8, 0.6, 0.55]} radius={0.03} smoothness={2} position={[0, 0.3, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={COLORS.white} roughness={0.5} />
        </RoundedBox>
        <RoundedBox args={[0.34, 0.3, 0.3]} radius={0.04} smoothness={2} position={[-0.45, 0.75, 0]} castShadow>
          <meshStandardMaterial color="#1a1b1f" roughness={0.5} />
        </RoundedBox>
        <mesh position={[0.4, 0.7, 0]} castShadow>
          <boxGeometry args={[0.5, 0.2, 0.3]} />
          <meshStandardMaterial color="#d7dbe1" roughness={0.6} />
        </mesh>
      </group>

      {/* Mesas dos agentes, sobre um tapete branco. */}
      <RoundedBox
        args={[rugWidth, 0.02, rugDepth]}
        radius={0.008}
        smoothness={2}
        position={[(DESK_RUG.minX + DESK_RUG.maxX) / 2, 0.01, (DESK_RUG.minZ + DESK_RUG.maxZ) / 2]}
        receiveShadow
      >
        <meshStandardMaterial color={COLORS.rug} roughness={0.95} />
      </RoundedBox>
      {DESKS.map((desk, index) => (
        <group key={index}>
          <Desk position={desk} plant={index % 3 === 1} seed={index + 1} />
          <OfficeChair pose={deskSeat(index)} />
        </group>
      ))}

      {/* Lounge na frente à esquerda. */}
      <RoundRug position={{ x: -8.1, z: 4.35 }} radius={2.15} />
      <Sofa position={{ x: -8.2, z: 3.55 }} />
      <CoffeeTable position={{ x: -8.1, z: 5.0 }} />

      {/* Mesa geral redonda. */}
      <RoundRug position={MEETING} radius={MEETING.rugRadius} />
      <MeetingTable position={MEETING} radius={MEETING.tableRadius} />
      {Array.from({ length: MEETING.seats }, (_, seat) => (
        <OfficeChair key={seat} pose={meetingChair(seat)} />
      ))}
      {Array.from({ length: MEETING.seats }, (_, seat) => {
        if (seat % 2 === 1) return null;
        const angle = meetingSeatAngle(seat);
        const radius = MEETING.tableRadius - 0.3;
        return (
          <Tablet
            key={seat}
            pose={{
              x: MEETING.x + Math.sin(angle) * radius,
              z: MEETING.z + Math.cos(angle) * radius,
              rotation: angle,
            }}
          />
        );
      })}

      {/* Sala de vidro do orquestrador. */}
      <mesh position={[(GLASS_ROOM.minX + GLASS_ROOM.maxX) / 2, 0.012, (GLASS_ROOM.minZ + GLASS_ROOM.maxZ) / 2]} receiveShadow>
        <boxGeometry args={[glassWidth, 0.024, glassDepth]} />
        <meshStandardMaterial color="#e6e8ec" roughness={0.6} />
      </mesh>
      <GlassWall from={{ x: GLASS_ROOM.doorMaxX, z: GLASS_ROOM.maxZ }} to={{ x: GLASS_ROOM.maxX, z: GLASS_ROOM.maxZ }} />
      <GlassWall from={{ x: GLASS_ROOM.minX, z: GLASS_ROOM.minZ }} to={{ x: GLASS_ROOM.minX, z: GLASS_ROOM.maxZ }} />
      <CortexDesk position={{ x: 8.25, z: -4.7 }} />
      <WallTv position={{ x: 8.1, z: BACK_Z + 0.06 }} y={2.05} width={2.6} height={1.46} texture={cortexTv.texture} />

      {/* Plantas. */}
      <Plant position={{ x: -10.3, z: 6.25 }} seed={2} />
      <Plant position={{ x: -10.3, z: -6.3 }} seed={3} scale={1.1} />
      <Plant position={{ x: 3.75, z: -6.4 }} seed={4} />
      <Plant position={{ x: 4.4, z: -2.1 }} seed={5} scale={0.9} />
      <Plant position={{ x: 10.2, z: -6.25 }} seed={6} />
      <Plant position={{ x: 10.25, z: 6.2 }} seed={7} scale={1.15} />
      <Plant position={{ x: -0.6, z: 5.9 }} seed={8} scale={0.95} />
      <Plant position={{ x: -5.7, z: 6.15 }} seed={9} scale={0.85} />
    </group>
  );
}

/** Logo da plataforma na parede da esquerda. */
function WallLogo() {
  const texture = useTexture("/logo-jayp-cortex.png");
  useEffect(() => prepareImageTexture(texture), [texture]);
  return (
    <mesh position={[LEFT_X + 0.02, 1.9, 2.55]} rotation={[0, Math.PI / 2, 0]}>
      <planeGeometry args={[2.9, 1.16]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  );
}
