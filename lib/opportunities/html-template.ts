import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PROPOSAL_HEADINGS } from "./constants";
import { PADRAO_HTML } from "./proposal-template-html";

export type ProposalTemplateSection = {
  heading: string;
  placeholder: string;
  selector: string;
};

const TEMPLATES: Record<string, string> = {
  padrao: PADRAO_HTML,
};

export function proposalSectionMap(): ProposalTemplateSection[] {
  return PROPOSAL_HEADINGS.map((heading) => ({
    heading,
    placeholder: `{{${heading}}}`,
    selector: `[data-section="${heading}"]`,
  }));
}

function fromDisk(name: string): string | null {
  try {
    return readFileSync(join(process.cwd(), "templates", "propostas", `${name}.html`), "utf8");
  } catch {
    return null;
  }
}

export function listProposalTemplateNames() {
  return Object.keys(TEMPLATES);
}

export function getProposalTemplate(name?: string) {
  const key = (name ?? "padrao").trim() || "padrao";
  const html = fromDisk(key) ?? TEMPLATES[key];
  if (!html) {
    throw new Error(`Template não encontrado: ${key}. Disponíveis: ${listProposalTemplateNames().join(", ")}`);
  }
  return {
    name: key,
    html,
    sections: proposalSectionMap(),
    extras: [
      { placeholder: "{{titulo}}", meaning: "Título da proposta (ex. [TAMURA] Proposal)" },
      { placeholder: "{{cliente}}", meaning: "Nome do cliente" },
      { placeholder: "{{data}}", meaning: "Data da entrega" },
    ],
  };
}
