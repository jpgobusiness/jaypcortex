// Planta do escritório 3D: posições das mesas, da mesa geral e os caminhos
// que os agentes fazem. Unidades em metros; y para cima; a câmera olha de +z.

import { DESK_COUNT } from "@/lib/agents";

export type Vec2 = { x: number; z: number };
/** Posição no chão + rotação em y (0 = de frente para +z, a câmera). */
export type Pose = Vec2 & { rotation: number };

export const FLOOR = { minX: -11, maxX: 11, minZ: -7, maxZ: 7, thickness: 0.4 };
export const WALL_HEIGHT = 3.2;
export const DESK_TOP = 0.74;

/* ---- Mesas dos agentes: 2 fileiras de 5, de frente para a câmera ---- */

export const DESK_COLUMNS = 5;
const DESK_X0 = -7;
export const DESK_SPACING = 2.25;
/** A fileira da frente (mais perto da câmera) é ocupada primeiro. */
const DESK_ROW_Z = [-1.1, -3.9];
/** Distância da cadeira até o centro da mesa (a cadeira fica atrás, em -z). */
const SEAT_OFFSET = 0.56;
/** Corredor na frente da fileira da frente. */
export const AISLE_Z = 0.6;

export function deskPosition(index: number): Vec2 {
  const column = index % DESK_COLUMNS;
  const row = Math.min(Math.floor(index / DESK_COLUMNS), DESK_ROW_Z.length - 1);
  return { x: DESK_X0 + column * DESK_SPACING, z: DESK_ROW_Z[row] };
}

export function deskSeat(index: number): Pose {
  const desk = deskPosition(index);
  return { x: desk.x, z: desk.z - SEAT_OFFSET, rotation: 0 };
}

export const DESKS = Array.from({ length: DESK_COUNT }, (_, index) => deskPosition(index));

/** Área do tapete branco sob as mesas. */
export const DESK_RUG = { minX: -8.35, maxX: 3.35, minZ: -5.35, maxZ: 0.15 };

/** Saída da mesa: de lado até o vão entre as mesas e depois até o corredor. */
function deskExit(index: number): Vec2[] {
  const seat = deskSeat(index);
  const lane = deskPosition(index).x + DESK_SPACING / 2;
  return [
    { x: lane, z: seat.z },
    { x: lane, z: AISLE_Z },
  ];
}

/* ---- Mesa geral (redonda), na frente à direita ---- */

export const MEETING = {
  x: 6.9,
  z: 2.7,
  tableRadius: 1.5,
  chairRadius: 2.15,
  seatRadius: 2.1,
  walkRadius: 2.95,
  rugRadius: 3.1,
  seats: 12,
};

/** Ângulo do lugar na mesa geral: 0 é a cabeceira (fundo, de frente para a câmera). */
export function meetingSeatAngle(seat: number) {
  const step = (Math.PI * 2) / MEETING.seats;
  const index = seat % MEETING.seats;
  if (index === 0) return Math.PI;
  const k = Math.ceil(index / 2);
  const side = index % 2 === 1 ? 1 : -1;
  return Math.PI + side * k * step;
}

function onRing(angle: number, radius: number): Vec2 {
  return {
    x: MEETING.x + Math.sin(angle) * radius,
    z: MEETING.z + Math.cos(angle) * radius,
  };
}

export function meetingSeat(seat: number): Pose {
  const angle = meetingSeatAngle(seat);
  // A cabeceira é do orquestrador: ele flutua na frente da cadeira, junto da mesa.
  const radius = seat % MEETING.seats === 0 ? 1.82 : MEETING.seatRadius;
  return { ...onRing(angle, radius), rotation: angle + Math.PI };
}

export function meetingChair(seat: number): Pose {
  const angle = meetingSeatAngle(seat);
  return { ...onRing(angle, MEETING.chairRadius), rotation: angle + Math.PI };
}

function angleAround(point: Vec2) {
  return Math.atan2(point.x - MEETING.x, point.z - MEETING.z);
}

/** Pontos ao longo do anel de circulação, sem passar pelas cadeiras. */
function arc(from: number, to: number): Vec2[] {
  let delta = to - from;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const steps = Math.max(1, Math.ceil(Math.abs(delta) / 0.28));
  return Array.from({ length: steps }, (_, i) =>
    onRing(from + (delta * (i + 1)) / steps, MEETING.walkRadius)
  );
}

/* ---- Sala de vidro do orquestrador (fundo, à direita) ---- */

export const GLASS_ROOM = { minX: 5.0, maxX: 10.7, minZ: -6.85, maxZ: -2.6, doorMinX: 5.2, doorMaxX: 6.6 };
export const ORCHESTRATOR_HOME: Pose = { x: 8.25, z: -5.5, rotation: 0 };
const ORCHESTRATOR_EXIT: Vec2[] = [
  { x: 5.9, z: -5.5 },
  { x: 5.9, z: -1.9 },
];

/* ---- Caminhos ---- */

export type Home = { pose: Pose; exit: Vec2[] };

export function deskHome(deskIndex: number): Home {
  return { pose: deskSeat(deskIndex), exit: deskExit(deskIndex) };
}

export const ORCHESTRATOR: Home = { pose: ORCHESTRATOR_HOME, exit: ORCHESTRATOR_EXIT };

/** Da cadeira de casa até o lugar na mesa geral. */
export function pathToMeeting(home: Home, seat: number): Vec2[] {
  const last = home.exit[home.exit.length - 1];
  const entry = angleAround(last);
  const seatAngle = meetingSeatAngle(seat);
  return [
    ...home.exit,
    onRing(entry, MEETING.walkRadius),
    ...arc(entry, seatAngle),
    meetingSeat(seat),
  ];
}

/** Do lugar na mesa geral de volta para a cadeira de casa. */
export function pathToHome(home: Home, seat: number): Vec2[] {
  const last = home.exit[home.exit.length - 1];
  const entry = angleAround(last);
  const seatAngle = meetingSeatAngle(seat);
  return [
    onRing(seatAngle, MEETING.walkRadius),
    ...arc(seatAngle, entry),
    ...[...home.exit].reverse(),
    home.pose,
  ];
}

/** Rotação em y para olhar de `from` para `to`. */
export function headingTo(from: Vec2, to: Vec2) {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

/** Diferença entre dois ângulos, no intervalo (-π, π]. */
export function angleDelta(from: number, to: number) {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

/* ---- Câmera ---- */

/** Visão geral: de frente e um pouco à direita, como no vídeo (vê as duas paredes). */
export const CAMERA_HOME = {
  position: [8.6, 18.2, 23.6] as const,
  target: [-0.7, 0.2, 0.1] as const,
};

/** Na reunião geral a câmera desce até a mesa redonda. */
export const CAMERA_MEETING = {
  position: [9.8, 8.6, 12.8] as const,
  target: [4.9, 0.6, 1.3] as const,
};

/** Afastamento da câmera ao focar um agente (frente, à direita, acima). */
export const CAMERA_FOCUS_OFFSET = [1.9, 2.9, 5.2] as const;
