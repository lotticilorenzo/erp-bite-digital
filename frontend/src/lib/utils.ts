import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const euroFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const euroFormatterDecimal = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Formats a number as € with no decimals: 12500 → "€ 12.500" */
export function formatEuro(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "—"
  return euroFormatter.format(value)
}

/** Formats a number as € with 2 decimal places: 12500.5 → "€ 12.500,50" */
export function formatEuroDecimal(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "—"
  return euroFormatterDecimal.format(value)
}

/** Formats a percentage: 42.3 → "42,3%" */
export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value == null || isNaN(value)) return "—"
  return `${value.toFixed(decimals).replace(".", ",")}%`
}

// ── MARGINE: semaforo unico (brief §4.2) ───────────────────────────────
// Bande sul MARGINE LORDO %: verde >40 / giallo 20–40 / arancio 0–20 / rosso <0.
// Sorgente unica lato FE; preferire il campo `semaforo` del backend dove disponibile.
export type Semaforo = "verde" | "giallo" | "arancio" | "rosso" | "grigio"

export function semaforoMargine(pct: number | null | undefined): Semaforo {
  if (pct == null || isNaN(pct)) return "grigio"
  if (pct < 0) return "rosso"
  if (pct < 20) return "arancio"
  if (pct < 40) return "giallo"
  return "verde"
}

const SEMAFORO_TEXT: Record<Semaforo, string> = {
  verde: "text-emerald-500",
  giallo: "text-amber-500",
  arancio: "text-orange-500",
  rosso: "text-rose-500",
  grigio: "text-muted-foreground",
}
const SEMAFORO_BG: Record<Semaforo, string> = {
  verde: "bg-emerald-500",
  giallo: "bg-amber-500",
  arancio: "bg-orange-500",
  rosso: "bg-rose-500",
  grigio: "bg-muted",
}

function toSemaforo(v: Semaforo | number | null | undefined): Semaforo {
  return typeof v === "string" ? v : semaforoMargine(v)
}

/** Classe tailwind testo per il semaforo margine. Accetta un Semaforo backend o un margine %. */
export function marginColorClass(v: Semaforo | number | null | undefined): string {
  return SEMAFORO_TEXT[toSemaforo(v)]
}

/** Classe tailwind background per il semaforo margine. */
export function marginBgClass(v: Semaforo | number | null | undefined): string {
  return SEMAFORO_BG[toSemaforo(v)]
}
