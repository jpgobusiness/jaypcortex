import * as THREE from "three";
import { seeded } from "@/components/office/palette";

/** Fonte da página (Geist), para os textos desenhados nas telas. */
function pageFont() {
  if (typeof document === "undefined") return "system-ui, sans-serif";
  return getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
}

function makeTexture(canvas: HTMLCanvasElement) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * Piso de tábuas de carvalho. A textura repete sem emenda nas duas direções:
 * cada fileira soma exatamente a largura do canvas.
 */
export function createWoodTexture() {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return makeTexture(canvas);

  const rand = seeded(11);
  const tones = ["#c9955f", "#bf8954", "#d2a16b", "#b9814f", "#cd9b65", "#c48e59", "#d6a873"];
  const rows = 8;
  const rowHeight = size / rows;

  const plank = (x: number, y: number, width: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, rowHeight);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, rowHeight);
    ctx.clip();
    ctx.strokeStyle = "rgba(110, 66, 34, 0.09)";
    ctx.lineWidth = 1.4;
    for (let g = 0; g < 6; g++) {
      const gy = y + 10 + rand() * (rowHeight - 20);
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.bezierCurveTo(
        x + width * 0.3,
        gy + (rand() - 0.5) * 12,
        x + width * 0.7,
        gy + (rand() - 0.5) * 12,
        x + width,
        gy + (rand() - 0.5) * 6
      );
      ctx.stroke();
    }
    // Brilho suave no meio da tábua.
    const shine = ctx.createLinearGradient(0, y, 0, y + rowHeight);
    shine.addColorStop(0, "rgba(255,255,255,0)");
    shine.addColorStop(0.5, "rgba(255,255,255,0.05)");
    shine.addColorStop(1, "rgba(0,0,0,0.04)");
    ctx.fillStyle = shine;
    ctx.fillRect(x, y, width, rowHeight);
    ctx.restore();
    ctx.fillStyle = "rgba(104, 64, 34, 0.42)";
    ctx.fillRect(x + width - 2, y, 2, rowHeight);
  };

  for (let row = 0; row < rows; row++) {
    const y = row * rowHeight;
    const offset = Math.floor(rand() * size);
    let used = 0;
    while (used < size) {
      const width = Math.min(260 + Math.floor(rand() * 320), size - used);
      const color = tones[Math.floor(rand() * tones.length)];
      const start = (offset + used) % size;
      plank(start, y, Math.min(width, size - start), color);
      if (start + width > size) plank(0, y, start + width - size, color);
      used += width;
    }
    ctx.fillStyle = "rgba(104, 64, 34, 0.5)";
    ctx.fillRect(0, y, size, 2);
  }

  const texture = makeTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export type DashboardData = {
  agents: { name: string; knowledge: number }[];
  totalDocs: number;
  inMeeting: number;
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Painel da TV grande: tamanho da equipe, base de conhecimento e barras por agente. */
export function drawDashboard(canvas: HTMLCanvasElement, data: DashboardData) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width: W, height: H } = canvas;
  const font = pageFont();

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#14171d");
  bg.addColorStop(1, "#0b0d11");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#8c94a3";
  ctx.font = `600 20px ${font}`;
  ctx.fillText("ESCRITÓRIO CORTEX", 48, 62);

  const count = data.agents.length;
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 64px ${font}`;
  ctx.fillText(`${count} ${count === 1 ? "agente" : "agentes"}`, 46, 132);

  ctx.fillStyle = "#22c55e";
  ctx.beginPath();
  ctx.arc(56, 168, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c5ccd6";
  ctx.font = `500 22px ${font}`;
  ctx.fillText(
    `${data.totalDocs} ${data.totalDocs === 1 ? "documento" : "documentos"} na base de conhecimento`,
    74,
    176
  );

  const withBase = data.agents.filter((agent) => agent.knowledge > 0).length;
  const percent = count ? Math.round((withBase / count) * 100) : 0;
  ctx.textAlign = "right";
  ctx.fillStyle = "#9d8ff8";
  ctx.font = `700 56px ${font}`;
  ctx.fillText(`${percent}%`, W - 48, 118);
  ctx.fillStyle = "#8c94a3";
  ctx.font = `500 18px ${font}`;
  ctx.fillText(data.inMeeting > 0 ? `${data.inMeeting} na mesa geral` : "com base de conhecimento", W - 48, 148);
  ctx.textAlign = "left";

  const top = 214;
  const bottom = H - 58;
  const left = 48;
  const right = W - 48;

  if (count === 0) {
    ctx.fillStyle = "#5f6775";
    ctx.font = `500 24px ${font}`;
    ctx.textAlign = "center";
    ctx.fillText("Crie agentes para ver a equipe aqui", W / 2, (top + bottom) / 2 + 8);
    ctx.textAlign = "left";
    return;
  }

  const slots = Math.max(count, 6);
  const gap = (right - left) / slots;
  const barWidth = Math.min(54, gap * 0.56);
  const max = Math.max(1, ...data.agents.map((agent) => agent.knowledge));
  const best = data.agents.reduce((a, b) => (b.knowledge > a.knowledge ? b : a));

  data.agents.forEach((agent, index) => {
    const cx = left + gap * (index + 0.5) + (gap * (slots - count)) / 2;
    const ratio = agent.knowledge / max;
    const height = Math.max(10, (bottom - top - 20) * (0.12 + 0.88 * ratio));
    const x = cx - barWidth / 2;
    const y = bottom - height;
    const highlight = agent === best && agent.knowledge > 0;
    ctx.fillStyle = highlight ? "#8b7cf6" : "#e8ebf0";
    roundRect(ctx, x, y, barWidth, height, 8);
    ctx.fill();
    ctx.fillStyle = highlight ? "#ffffff" : "#1b1e24";
    ctx.font = `700 18px ${font}`;
    ctx.textAlign = "center";
    if (height > 34) ctx.fillText(String(agent.knowledge), cx, y + 26);
    ctx.fillStyle = "#8c94a3";
    ctx.font = `500 16px ${font}`;
    const label = agent.name.length > 9 ? `${agent.name.slice(0, 8)}…` : agent.name;
    ctx.fillText(label, cx, bottom + 30);
    ctx.textAlign = "left";
  });
}

/** Tela da sala de vidro do orquestrador. */
export function drawCortexScreen(canvas: HTMLCanvasElement, line: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width: W, height: H } = canvas;
  const font = pageFont();
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#151a2c");
  bg.addColorStop(1, "#0b0e18");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W * 0.78, H * 0.42, 10, W * 0.78, H * 0.42, 150);
  glow.addColorStop(0, "rgba(34, 211, 238, 0.55)");
  glow.addColorStop(1, "rgba(34, 211, 238, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(123, 104, 238, 0.9)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(W * 0.78, H * 0.42, 92, 30, -0.35, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#e9f8ff";
  ctx.beginPath();
  ctx.arc(W * 0.78, H * 0.42, 44, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = `700 54px ${font}`;
  ctx.fillText("Cortex", 44, 112);
  ctx.fillStyle = "#9aa3b5";
  ctx.font = `500 24px ${font}`;
  ctx.fillText("Orquestrador do escritório", 46, 152);
  ctx.fillStyle = "#22c55e";
  ctx.beginPath();
  ctx.arc(54, 222, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d7dce6";
  ctx.font = `500 24px ${font}`;
  ctx.fillText(line, 74, 231);
}

export type CanvasTarget = { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture };

/** Canvas + textura que o React mantém e redesenha quando os dados mudam. */
export function createCanvasTexture(width: number, height: number): CanvasTarget {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return { canvas, texture: makeTexture(canvas) };
}

/** Redesenha o painel da TV grande e avisa a GPU. */
export function paintDashboard(target: CanvasTarget, data: DashboardData) {
  drawDashboard(target.canvas, data);
  target.texture.needsUpdate = true;
}

/** Redesenha a tela da sala do orquestrador e avisa a GPU. */
export function paintCortexScreen(target: CanvasTarget, line: string) {
  drawCortexScreen(target.canvas, line);
  target.texture.needsUpdate = true;
}

/** Ajusta uma imagem carregada (cores e nitidez em ângulo). */
export function prepareImageTexture(texture: THREE.Texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
}
