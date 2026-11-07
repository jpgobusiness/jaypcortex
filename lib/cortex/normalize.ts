const SYNONYMS: Array<[RegExp, string]> = [
  [/\btarefas?\b/g, "atividade"],
  [/\bpendencias?\b/g, "atividade"],
  [/\bto-?dos?\b/g, "atividade"],
  [/\bafazeres\b/g, "atividade"],
  [/\bcalendario\b/g, "agenda"],
  [/\bmigracao\b/g, "map"],
  [/\bmigracoes\b/g, "map"],
  [/\bassessment\b/g, "assess"],
  [/\bassessments\b/g, "assess"],
  [/\bprioridades?\b/g, "prioridade"],
  [/\bprocrastinar\b/g, "procrastinacao"],
  [/\bprocrastino\b/g, "procrastinacao"],
  [/\bapag(?:a|ar|ue)\b/g, "apagar"],
  [/\bdelet(?:a|ar|e)\b/g, "apagar"],
  [/\bexclui(?:r)?\b/g, "apagar"],
  [/\bconclu(?:i|ir|a)\b/g, "concluir"],
  [/\bfinaliz(?:a|ar)\b/g, "concluir"],
  [/\bmarca(?:r)? como (?:feita|pronto|concluida)\b/g, "concluir"],
];

export function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "");
}

export function normalize(text: string): string {
  let s = stripAccents((text || "").toLowerCase());
  s = s.replace(/[^\p{L}\p{N}\s]/gu, " ");
  s = s.replace(/\s+/g, " ").trim();
  for (const [pattern, replacement] of SYNONYMS) {
    s = s.replace(pattern, replacement);
  }
  return s.replace(/\s+/g, " ").trim();
}

export function tokens(text: string, minLength = 2): string[] {
  return normalize(text).split(" ").filter((t) => t.length >= minLength);
}

export function tokenSet(text: string, minLength = 2): Set<string> {
  return new Set(tokens(text, minLength));
}
