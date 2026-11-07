"use client";

import {
  AlertTriangle,
  Building2,
  Check,
  Cloud,
  Database,
  Lightbulb,
  Server,
  User,
} from "lucide-react";

export type MindMapShapeKind =
  | "rectangle"
  | "rounded"
  | "circle"
  | "ellipse"
  | "triangle"
  | "diamond"
  | "hexagon"
  | "octagon"
  | "star"
  | "arrow"
  | "process"
  | "decision"
  | "terminator"
  | "data"
  | "document"
  | "subprocess"
  | "cylinder"
  | "cloud"
  | "note"
  | "speech"
  | "icon-user"
  | "icon-building"
  | "icon-server"
  | "icon-database"
  | "icon-lightbulb"
  | "icon-check"
  | "icon-alert";

export type ShapeDefinition = {
  kind: MindMapShapeKind;
  label: string;
  category: "Básicas" | "Fluxograma" | "Dados e anotações" | "Ícones";
  width: number;
  height: number;
};

export const SHAPE_DEFINITIONS: ShapeDefinition[] = [
  { kind: "rectangle", label: "Retângulo", category: "Básicas", width: 160, height: 90 },
  { kind: "rounded", label: "Arredondado", category: "Básicas", width: 160, height: 90 },
  { kind: "circle", label: "Círculo", category: "Básicas", width: 110, height: 110 },
  { kind: "ellipse", label: "Elipse", category: "Básicas", width: 170, height: 90 },
  { kind: "triangle", label: "Triângulo", category: "Básicas", width: 140, height: 120 },
  { kind: "diamond", label: "Losango", category: "Básicas", width: 150, height: 110 },
  { kind: "hexagon", label: "Hexágono", category: "Básicas", width: 160, height: 100 },
  { kind: "octagon", label: "Octógono", category: "Básicas", width: 140, height: 120 },
  { kind: "star", label: "Estrela", category: "Básicas", width: 130, height: 125 },
  { kind: "arrow", label: "Seta", category: "Básicas", width: 180, height: 80 },
  { kind: "process", label: "Processo", category: "Fluxograma", width: 170, height: 90 },
  { kind: "decision", label: "Decisão", category: "Fluxograma", width: 150, height: 115 },
  { kind: "terminator", label: "Início / fim", category: "Fluxograma", width: 170, height: 75 },
  { kind: "data", label: "Entrada / saída", category: "Fluxograma", width: 170, height: 90 },
  { kind: "document", label: "Documento", category: "Fluxograma", width: 160, height: 105 },
  { kind: "subprocess", label: "Subprocesso", category: "Fluxograma", width: 175, height: 90 },
  { kind: "cylinder", label: "Banco de dados", category: "Dados e anotações", width: 140, height: 120 },
  { kind: "cloud", label: "Nuvem", category: "Dados e anotações", width: 170, height: 105 },
  { kind: "note", label: "Nota", category: "Dados e anotações", width: 150, height: 110 },
  { kind: "speech", label: "Balão", category: "Dados e anotações", width: 170, height: 100 },
  { kind: "icon-user", label: "Pessoa", category: "Ícones", width: 100, height: 100 },
  { kind: "icon-building", label: "Empresa", category: "Ícones", width: 100, height: 100 },
  { kind: "icon-server", label: "Servidor", category: "Ícones", width: 100, height: 100 },
  { kind: "icon-database", label: "Database", category: "Ícones", width: 100, height: 100 },
  { kind: "icon-lightbulb", label: "Ideia", category: "Ícones", width: 100, height: 100 },
  { kind: "icon-check", label: "Concluído", category: "Ícones", width: 100, height: 100 },
  { kind: "icon-alert", label: "Alerta", category: "Ícones", width: 100, height: 100 },
];

const ICONS = {
  "icon-user": User,
  "icon-building": Building2,
  "icon-server": Server,
  "icon-database": Database,
  "icon-lightbulb": Lightbulb,
  "icon-check": Check,
  "icon-alert": AlertTriangle,
} as const;

export function ShapeGraphic({
  kind,
  color,
  className = "",
}: {
  kind: MindMapShapeKind;
  color: string;
  className?: string;
}) {
  const Icon = ICONS[kind as keyof typeof ICONS];
  if (Icon) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center rounded-2xl border-2 border-slate-500 ${className}`}
        style={{ backgroundColor: color }}
      >
        <Icon className="h-1/2 w-1/2 text-slate-700" strokeWidth={1.7} />
      </div>
    );
  }

  const common = {
    fill: color,
    stroke: "#64748b",
    strokeWidth: 2,
    vectorEffect: "non-scaling-stroke" as const,
  };

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={`h-full w-full overflow-visible ${className}`}
      aria-hidden
    >
      {(kind === "rectangle" || kind === "process") && (
        <rect x="1" y="1" width="98" height="98" {...common} />
      )}
      {kind === "rounded" && (
        <rect x="1" y="1" width="98" height="98" rx="12" {...common} />
      )}
      {kind === "circle" && <circle cx="50" cy="50" r="48" {...common} />}
      {kind === "ellipse" && <ellipse cx="50" cy="50" rx="48" ry="46" {...common} />}
      {kind === "triangle" && <polygon points="50,2 98,98 2,98" {...common} />}
      {(kind === "diamond" || kind === "decision") && (
        <polygon points="50,1 99,50 50,99 1,50" {...common} />
      )}
      {kind === "hexagon" && (
        <polygon points="25,1 75,1 99,50 75,99 25,99 1,50" {...common} />
      )}
      {kind === "octagon" && (
        <polygon points="30,1 70,1 99,30 99,70 70,99 30,99 1,70 1,30" {...common} />
      )}
      {kind === "star" && (
        <polygon points="50,1 61,35 98,35 68,56 79,98 50,73 21,98 32,56 2,35 39,35" {...common} />
      )}
      {kind === "arrow" && (
        <polygon points="1,30 65,30 65,8 99,50 65,92 65,70 1,70" {...common} />
      )}
      {kind === "terminator" && (
        <rect x="1" y="8" width="98" height="84" rx="42" {...common} />
      )}
      {kind === "data" && (
        <polygon points="18,1 99,1 82,99 1,99" {...common} />
      )}
      {kind === "document" && (
        <path d="M1 1H99V78C78 65 67 94 48 82C30 70 19 92 1 82Z" {...common} />
      )}
      {kind === "subprocess" && (
        <>
          <rect x="1" y="1" width="98" height="98" {...common} />
          <path d="M12 1V99M88 1V99" fill="none" stroke="#64748b" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </>
      )}
      {kind === "cylinder" && (
        <>
          <path d="M5 18C5 7 25 1 50 1S95 7 95 18V82C95 93 75 99 50 99S5 93 5 82Z" {...common} />
          <ellipse cx="50" cy="18" rx="45" ry="17" {...common} />
          <path d="M5 82C5 93 25 99 50 99S95 93 95 82" fill="none" stroke="#64748b" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </>
      )}
      {kind === "cloud" && (
        <path d="M25 83C9 83 1 72 4 59C6 48 15 42 25 42C27 20 44 8 62 19C72 16 84 22 86 34C101 38 104 55 96 65C93 77 82 83 69 83Z" {...common} />
      )}
      {kind === "note" && (
        <>
          <polygon points="1,1 78,1 99,22 99,99 1,99" {...common} />
          <polyline points="78,1 78,22 99,22" fill="none" stroke="#64748b" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </>
      )}
      {kind === "speech" && (
        <path d="M8 5H92C96 5 99 9 99 14V70C99 75 96 79 92 79H42L22 97L26 79H8C4 79 1 75 1 70V14C1 9 4 5 8 5Z" {...common} />
      )}
    </svg>
  );
}

export function ShapePalette({
  onChoose,
}: {
  onChoose: (definition: ShapeDefinition) => void;
}) {
  const categories = Array.from(
    new Set(SHAPE_DEFINITIONS.map((definition) => definition.category))
  );
  return (
    <div className="absolute right-3 top-14 z-40 max-h-[70vh] w-80 overflow-y-auto rounded-xl border border-[var(--border)] bg-white p-3 shadow-xl">
      {categories.map((category) => (
        <div key={category} className="mb-4 last:mb-0">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            {category}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {SHAPE_DEFINITIONS.filter(
              (definition) => definition.category === category
            ).map((definition) => (
              <button
                key={definition.kind}
                type="button"
                title={definition.label}
                onClick={() => onChoose(definition)}
                className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border border-[var(--border)] p-2 text-[10px] text-[var(--foreground)] hover:border-[var(--brand)] hover:bg-[var(--brand)]/5"
              >
                <span className="block h-7 w-9">
                  <ShapeGraphic
                    kind={definition.kind}
                    color="#ede9fe"
                  />
                </span>
                <span className="line-clamp-2 leading-tight">
                  {definition.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
