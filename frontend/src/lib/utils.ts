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
