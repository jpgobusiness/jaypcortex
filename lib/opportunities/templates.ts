import type { EditorDocument } from "@/lib/types";
import { headingsDocument } from "@/lib/tiptap/sections";
import {
  CONTEXT_HEADINGS,
  PROPOSAL_HEADINGS,
} from "./constants";

export {
  CONTEXT_HEADINGS,
  CONTEXT_TEMPLATE_TITLE,
  OPPORTUNITIES_KEY,
  PROPOSAL_HEADINGS,
  PROPOSAL_TEMPLATE_TITLE,
  TEMPLATES_FOLDER,
} from "./constants";

export function proposalTemplateDoc(): EditorDocument {
  return headingsDocument([...PROPOSAL_HEADINGS]);
}

export function contextTemplateDoc(): EditorDocument {
  return headingsDocument([...CONTEXT_HEADINGS]);
}

export function cloneDoc(doc: EditorDocument): EditorDocument {
  return JSON.parse(JSON.stringify(doc)) as EditorDocument;
}
