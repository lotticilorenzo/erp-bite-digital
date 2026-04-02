import type { Cliente } from "./index";

export type StudioView = "home" | "dash" | "list" | "kanban" | "cal";

export interface StudioState {
  view: StudioView;
  selectedFolderId: string | null; // Cliente ID
  selectedListId: string | null;   // Progetto ID
  selectedTaskId: string | null;   // Task ID
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
  subtasks: SubtaskSO[];
}

export type TaskSO = {
  id: string;
  title: string;
  desc?: string;
  assignees: string[]; // User IDs
  start_date: string | null;
  due_date: string | null;
  state_id: string;
  estimated_hours: number;
  subtasks: SubtaskSO[];
  custom_values?: Record<string, any>;
  // Support for ClickUp mapping
  clickup_id?: string;
  parent_id?: string;
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

export type StudioTimer = {
  active_task_id: string | null;
  started_at: number | null;
  elapsed: Record<string, number>; // taskId -> ms
}

export const DEFAULT_STATES: StudioStatus[] = [
  { id: "todo", name: "To Do", color: "#64748b", order: 0 },
  { id: "in-progress", name: "In Corso", color: "#7c3aed", order: 1 },
  { id: "done", name: "Completato", color: "#10b981", order: 2 },
];

export const AGILE_STATES: StudioStatus[] = [
  { id: "backlog", name: "Backlog", color: "#475569", order: 0 },
  { id: "planned", name: "Pianificato", color: "#3b82f6", order: 1 },
  { id: "in-progress", name: "In Corso", color: "#7c3aed", order: 2 },
  { id: "review", name: "Review", color: "#f59e0b", order: 3 },
  { id: "done", name: "Completato", color: "#10b981", order: 4 },
];
