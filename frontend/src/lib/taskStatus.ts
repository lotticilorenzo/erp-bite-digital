import type { TaskStatus } from "@/types";

/**
 * Fonte di verità UNICA per gli stati dei task di Studio OS.
 * I `value` corrispondono ESATTAMENTE all'enum backend `TaskStatus` (models.py:64-71):
 * DA_FARE, BOZZE_IDEE, DA_CORREGGERE, IN_REVIEW, PRONTO, PROGRAMMATO, PUBBLICATO.
 * Ordine = ordine di workflow (= ordine dell'enum).
 */
export interface TaskStatusDef {
  value: TaskStatus;
  label: string;
  color: string; // hex (badge/punto)
  accent: string; // classe bordo colonna
  bg: string; // classe sfondo colonna
}

export const TASK_STATUSES: TaskStatusDef[] = [
  { value: "DA_FARE", label: "Da Fare", color: "#ef4444", accent: "border-red-500/40", bg: "bg-red-500/5" },
  { value: "BOZZE_IDEE", label: "Bozze / Idee", color: "#eab308", accent: "border-yellow-500/40", bg: "bg-yellow-500/5" },
  { value: "DA_CORREGGERE", label: "Da Correggere", color: "#f97316", accent: "border-orange-500/40", bg: "bg-orange-500/5" },
  { value: "IN_REVIEW", label: "In Review", color: "#d946ef", accent: "border-fuchsia-500/40", bg: "bg-fuchsia-500/5" },
  { value: "PRONTO", label: "Pronto", color: "#3b82f6", accent: "border-blue-500/40", bg: "bg-blue-500/5" },
  { value: "PUBBLICATO", label: "Pubblicato", color: "#22c55e", accent: "border-green-500/40", bg: "bg-green-500/5" },
];

export const TASK_STATUS_BY_VALUE: Record<string, TaskStatusDef> = Object.fromEntries(
  TASK_STATUSES.map((s) => [s.value, s])
);

/** Stato terminale = "completato/done" (l'enum non ha COMPLETATO). */
export const TASK_DONE_STATUS: TaskStatus = "PUBBLICATO";

/** True se lo stato (case-insensitive, tollerante al legacy "done") rappresenta "fatto". */
export const isTaskDone = (v?: string | null): boolean => {
  const up = (v ?? "").toUpperCase();
  return up === TASK_DONE_STATUS || up === "DONE";
};
