import * as THREE from "three";

/** Cores do escritório (tons claros, como no vídeo de referência). */
export const COLORS = {
  background: "#eceef2",
  white: "#f7f8fa",
  offWhite: "#eceef1",
  rug: "#f2f3f2",
  wall: "#e8eaed",
  wallTop: "#f6f7f8",
  baseboard: "#d9dce1",
  sage: "#c7d6cd",
  black: "#24262b",
  charcoal: "#2f3238",
  steel: "#3b3f46",
  woodEdge: "#a5703f",
  glass: "#d6e8f5",
  screen: "#0f1115",
  brand: "#7b68ee",
  brandSoft: "#a99cf5",
  cyan: "#22d3ee",
  plants: ["#3f9c4f", "#4bae59", "#2f8b42", "#57b765"],
  holo: ["#3b82f6", "#06b6d4", "#10b981", "#8b5cf6", "#2563eb", "#14b8a6", "#f97316"],
};

/** Gerador pseudoaleatório com semente (mesma cena em todo carregamento). */
export function seeded(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Escurece (amount < 0) ou clareia (amount > 0) uma cor hex. */
export function shade(hex: string, amount: number) {
  const color = new THREE.Color(hex);
  const target = new THREE.Color(amount < 0 ? "#000000" : "#ffffff");
  return `#${color.lerp(target, Math.abs(amount)).getHexString()}`;
}

/** Número estável a partir de um texto (ex.: id do agente). */
export function hashString(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
