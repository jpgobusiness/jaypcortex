// Tipos compartilhados no frontend (espelham as respostas das APIs).

export type ActivityType = {
  id: string;
  name: string;
  color: string;
  _count?: { activities: number };
};

export type ActivityPriority = "low" | "normal" | "high" | "urgent";

// Status de atividade configurável (vindo do banco). `key` é o valor em Activity.status.
export type ActivityStatusDef = {
  id: string;
  key: string;
  name: string;
  color: string;
  order: number;
  isDone: boolean;
  isInProgress?: boolean;
  _count?: { activities: number };
};

export type Activity = {
  id: string;
  title: string;
  typeId: string | null;
  type?: ActivityType | null;
  opportunityId: string | null;
  opportunity?: { id: string; name: string } | null;
  status: string; // key de ActivityStatusDef
  priority: ActivityPriority;
  dueDate: string | null;
  notes: string | null;
  completedAt: string | null;
  queueOrder: number | null; // posição na fila de prioridades
  description?: string | null;
  startedAt?: string | null;
  estimatedMinutes?: number | null;
  spentMinutes?: number | null;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  importance?: number | null;
  urgency?: number | null;
  energy?: string | null;
  context?: string | null;
  tags?: string[];
  area?: string | null;
  waitingOn?: string | null;
  recurrenceRule?: string | null;
  deletedAt?: string | null;
  source?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AutomationContact = {
  id: string;
  automationKey: string;
  name: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
};

/* ---- Horas extras ---- */

export type OvertimeAttachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

export type OvertimeEntry = {
  id: string;
  monthId: string;
  date: string;
  hours: number;
  description: string | null;
  clickupRequested: boolean;
  attachments: OvertimeAttachment[];
  createdAt: string;
  updatedAt: string;
};

export type OvertimeMonthDetail = {
  id: string;
  monthKey: string;
  hourlyRate: number;
  goalHours: number;
  totalHours: number;
  totalValue: number;
  entries: OvertimeEntry[];
};

export type OvertimeMonthSummary = {
  id: string;
  monthKey: string;
  hourlyRate: number;
  goalHours: number;
  totalHours: number;
  totalValue: number;
  entryCount: number;
};

export const ACTIVITY_PRIORITY_LABELS: Record<ActivityPriority, string> = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

/* ---- Espaços de trabalho ---- */

/** Documento do editor de arquivos (formato JSON do TipTap). */
export type EditorDocument = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: EditorDocument[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
};

export type Workspace = {
  id: string;
  name: string;
  key?: string | null;
  description: string | null;
  color: string;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type FunnelOpportunityChip = {
  id: string;
  name: string;
  client: string | null;
  value: number;
  stage: { id: string; name: string; color: string } | null;
};

export type WorkspaceFileSummary = {
  id: string;
  workspaceId: string;
  folderId: string | null;
  title: string;
  excerpt: string;
  order: number;
  kind?: string;
  tags?: string[];
  indexStatus?: string;
  indexedAt?: string | null;
  source?: string;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FolderAsset = {
  id: string;
  workspaceId: string;
  folderId: string | null;
  kind: string;
  name: string;
  mimeType: string;
  size: number;
  source: string;
  createdAt: string;
  url?: string;
  expires_at?: string;
};

export type WorkspaceFolder = {
  id: string;
  workspaceId: string;
  name: string;
  order: number;
  opportunityId?: string | null;
  opportunity?: FunnelOpportunityChip | null;
  createdAt: string;
  updatedAt: string;
  files: WorkspaceFileSummary[];
  assets?: FolderAsset[];
};

/** Espaço com as pastas e os arquivos (sem o conteúdo dos arquivos). */
export type WorkspaceTree = Workspace & {
  folders: WorkspaceFolder[];
  /** Arquivos que não estão em nenhuma pasta. */
  files: WorkspaceFileSummary[];
  /** Anexos soltos no espaço (folderId nulo). */
  assets?: FolderAsset[];
  /** Agente dono do espaço, quando o espaço é a sala dele no escritório. */
  agent?: { id: string; name: string; isOrchestrator: boolean } | null;
};

export type WorkspaceFileDetail = WorkspaceFileSummary & {
  content: EditorDocument | null;
};

/* ---- Escritório de agentes ---- */

export type AgentHairStyle =
  | "short"
  | "spiky"
  | "bob"
  | "curly"
  | "bun"
  | "long"
  | "beanie";

export type AgentAccessory = "none" | "headphones" | "glasses";

export type AgentAppearance = {
  skinTone: string;
  hairStyle: AgentHairStyle;
  hairColor: string;
  shirtColor: string;
  accessory: AgentAccessory;
};

export type Agent = AgentAppearance & {
  id: string;
  name: string;
  slug?: string | null;
  status?: string;
  role: string;
  description: string;
  instructions: string;
  isOrchestrator: boolean;
  /** Mesa no escritório. O orquestrador fica na sala de vidro (null). */
  deskIndex: number | null;
  workspaceId: string | null;
  knowledgeCount: number;
  /** Sala do agente: o espaço de trabalho com os arquivos dele. */
  room: { id: string; name: string; fileCount: number } | null;
  createdAt: string;
  updatedAt: string;
};

/** Documento anexado à base de conhecimento de um agente. */
export type AgentKnowledgeItem = {
  fileId: string;
  title: string;
  excerpt: string;
  workspaceId: string;
  workspaceName: string;
  folderName: string | null;
  kind?: string;
  indexStatus?: string;
  updatedAt: string;
  attachedAt: string;
};
