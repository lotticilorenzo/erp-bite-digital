import type { Cliente } from "./index";

export type StudioView = "home" | "dash" | "list" | "kanban" | "cal" | "team" | "carico-lavoro" | "overview" | "chat" | "files";

export interface TabItem {
  id: string;
  type: "PROJECT" | "TASK" | "DASHBOARD" | "CHAT";
  title: string;
  linkedId?: string;
}

export interface StudioState {
  view: StudioView;
  selectedFolderId: string | null;
  selectedListId: string | null;
  selectedTaskId: string | null;
  openTabs: TabItem[];
  activeTabId: string | null;
  splitTabId: string | null;
}

export interface StudioNode {
  id: string;
  parent_id: string | null;
  tipo: "folder" | "project" | "task" | "dashboard";
  nome: string;
  icon?: string;
  color?: string;
  linked_progetto_id?: string;
  linked_task_id?: string;
  is_private: boolean;
  order: number;
  children: StudioNode[];
}

export type WorkspaceSO = {
  id: string;
  name: string;
  spaces: SpaceSO[];
}

export type SpaceSO = {
  id: string;
  name: string;
  folders: Cliente[]; // Mapping Folder to Cliente
}

export type SubtaskSO = {
  id: string;
  title: string;
  stateId: string;
  tempo_trascorso_minuti?: number;
  subtasks: SubtaskSO[];
}

export type TaskSO = {
  id: string;
  title: string;
  desc?: string;
  assignees: string[]; // User IDs
  data_inizio: string | null;
  due_date: string | null;
  state_id: string;
  estimated_hours: number;
  subtasks: SubtaskSO[];
  custom_values?: Record<string, any>;
  progetto_id?: string;
  progetto?: any;
  commessa_id?: string;
  parent_id?: string;
  assegnatario_id?: string;
  stima_minuti?: number;
  tempo_trascorso_minuti?: number;
  priorita?: string | null;
  // Deprecated ClickUp fields
  clickup_id?: string;
  folder_id?: string;
  list_id?: string;
}

export type StudioList = {
  id: string;
  name: string;
  project_id: string;
  states: StudioStatus[];
  tasks: TaskSO[];
  field_config: FieldConfig;
}

export type StudioStatus = {
  id: string;
  name: string;
  color: string;
  order: number;
}

export type FieldConfig = {
  visible: Record<string, boolean>;
  custom: CustomField[];
}

export type CustomField = {
  id: string;
  name: string;
  type: "text" | "number" | "progress";
}

export interface TimerSessionSO {
  id: string;
  task_id: string;
  task_title?: string;
  user_id: string;
  started_at: string;
  stopped_at: string | null;
  durata_minuti: number | null;
  note: string | null;
  salvato_timesheet: boolean;
}

export type StudioTimer = {
  active_session: TimerSessionSO | null;
}

/** Maps both DB enum values AND legacy ClickUp-style IDs to a StudioStatus. */
export function getTaskState(stateId: string): StudioStatus {
  return (
    DEFAULT_STATES.find((s) => s.id === stateId) ??
    DEFAULT_STATES[0]
  );
}

export const DEFAULT_STATES: StudioStatus[] = [
  { id: "DA_FARE",    name: "Da Fare",    color: "#64748b", order: 0 },
  { id: "IN_CORSO",   name: "In Corso",   color: "#7c3aed", order: 1 },
  { id: "REVISIONE",  name: "Revisione",  color: "#f59e0b", order: 2 },
  { id: "COMPLETATO", name: "Completato", color: "#10b981", order: 3 },
];

export const PRIORITIES: { id: string; label: string; color: string; bg: string }[] = [
  { id: "alta",   label: "Alta",   color: "text-red-400",    bg: "bg-red-500/15" },
  { id: "media",  label: "Media",  color: "text-yellow-400", bg: "bg-yellow-500/15" },
  { id: "bassa",  label: "Bassa",  color: "text-slate-400",  bg: "bg-slate-500/15" },
];

export const AGILE_STATES: StudioStatus[] = [
  { id: "DA_FARE",    name: "Backlog",     color: "#475569", order: 0 },
  { id: "IN_CORSO",   name: "In Corso",    color: "#7c3aed", order: 1 },
  { id: "REVISIONE",  name: "Review",      color: "#f59e0b", order: 2 },
  { id: "COMPLETATO", name: "Completato",  color: "#10b981", order: 3 },
];
