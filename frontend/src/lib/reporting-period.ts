import {
  addMonths,
  differenceInCalendarMonths,
  endOfMonth,
  format,
  isValid,
  parseISO,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subMonths,
  subYears,
} from "date-fns";
import { it } from "date-fns/locale";

export type ReportingPeriodPreset =
  | "CURRENT_MONTH"
  | "PREVIOUS_MONTH"
  | "QUARTER"
  | "SEMESTER"
  | "CURRENT_YEAR"
  | "CUSTOM";

export type ReportingDateRange = {
  from: Date;
  to: Date;
};

export const REPORTING_PERIOD_OPTIONS: Array<{ value: ReportingPeriodPreset; label: string }> = [
  { value: "CURRENT_MONTH", label: "Mese corrente" },
  { value: "PREVIOUS_MONTH", label: "Mese precedente" },
  { value: "QUARTER", label: "Trimestre" },
  { value: "SEMESTER", label: "Semestre" },
  { value: "CURRENT_YEAR", label: "Anno corrente" },
  { value: "CUSTOM", label: "Personalizzato" },
];

export function formatDateInput(value: Date) {
  return format(value, "yyyy-MM-dd");
}

export function parseDateInput(value: string, fallback: Date) {
  if (!value) {
    return fallback;
  }

  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : fallback;
}

function getSemesterStart(referenceDate: Date) {
  const year = referenceDate.getFullYear();
  return referenceDate.getMonth() < 6 ? new Date(year, 0, 1) : new Date(year, 6, 1);
}

export function getReferenceDateForPreset(preset: ReportingPeriodPreset, today: Date) {
  return preset === "PREVIOUS_MONTH" ? subMonths(today, 1) : today;
}

export function getRangeForPreset(
  preset: Exclude<ReportingPeriodPreset, "CUSTOM">,
  today: Date
): ReportingDateRange {
  const referenceDate = getReferenceDateForPreset(preset, today);

  switch (preset) {
    case "CURRENT_MONTH":
    case "PREVIOUS_MONTH":
      return {
        from: startOfMonth(referenceDate),
        to: endOfMonth(referenceDate),
      };
    case "QUARTER":
      return {
        from: startOfQuarter(referenceDate),
        to: endOfMonth(referenceDate),
      };
    case "SEMESTER":
      return {
        from: getSemesterStart(referenceDate),
        to: endOfMonth(referenceDate),
      };
    case "CURRENT_YEAR":
    default:
      return {
        from: startOfYear(referenceDate),
        to: endOfMonth(referenceDate),
      };
  }
}

export function resolveReportingRange(
  preset: ReportingPeriodPreset,
  dateFrom: string,
  dateTo: string,
  today: Date
): ReportingDateRange {
  const fallbackRange = getRangeForPreset(
    preset === "CUSTOM" ? "CURRENT_MONTH" : preset,
    today
  );
  const parsedFrom = startOfMonth(parseDateInput(dateFrom, fallbackRange.from));
  const parsedTo = endOfMonth(parseDateInput(dateTo, fallbackRange.to));

  if (parsedFrom <= parsedTo) {
    return { from: parsedFrom, to: parsedTo };
  }

  return { from: startOfMonth(parsedTo), to: endOfMonth(parsedFrom) };
}

export function getPeriodLabel(preset: ReportingPeriodPreset, range: ReportingDateRange) {
  if (preset === "CURRENT_MONTH" || preset === "PREVIOUS_MONTH") {
    return format(range.from, "MMMM yyyy", { locale: it });
  }

  if (preset === "CUSTOM") {
    return `${format(range.from, "dd MMM yyyy", { locale: it })} - ${format(range.to, "dd MMM yyyy", {
      locale: it,
    })}`;
  }

  const presetLabel =
    REPORTING_PERIOD_OPTIONS.find((option) => option.value === preset)?.label ?? "Periodo";

  return `${presetLabel} | ${format(range.from, "dd MMM yyyy", { locale: it })} - ${format(
    range.to,
    "dd MMM yyyy",
    { locale: it }
  )}`;
}

export function getTrendDescription(range: ReportingDateRange) {
  return getMonthlyBuckets(range).length > 1
    ? "Andamento mensile del periodo selezionato"
    : "Periodo mensile selezionato";
}

export function getMonthlyBuckets(range: ReportingDateRange) {
  const startMonth = startOfMonth(range.from);
  const endMonth = startOfMonth(range.to);
  const monthCount = Math.max(differenceInCalendarMonths(endMonth, startMonth) + 1, 1);

  return Array.from({ length: monthCount }, (_, index) => addMonths(startMonth, index));
}

export function getComparisonRange(
  preset: ReportingPeriodPreset,
  range: ReportingDateRange,
  today: Date
): ReportingDateRange {
  if (preset === "CURRENT_MONTH") {
    return getRangeForPreset("PREVIOUS_MONTH", today);
  }

  if (preset === "PREVIOUS_MONTH") {
    const twoMonthsAgo = subMonths(today, 2);
    return {
      from: startOfMonth(twoMonthsAgo),
      to: endOfMonth(twoMonthsAgo),
    };
  }

  if (preset === "CURRENT_YEAR") {
    const previousYearDate = subYears(today, 1);
    return {
      from: startOfYear(previousYearDate),
      to: endOfMonth(new Date(previousYearDate.getFullYear(), range.to.getMonth(), 1)),
    };
  }

  const monthSpan = Math.max(
    differenceInCalendarMonths(startOfMonth(range.to), startOfMonth(range.from)) + 1,
    1
  );
  const comparisonEnd = endOfMonth(subMonths(range.from, 1));
  const comparisonStart = startOfMonth(subMonths(range.from, monthSpan));

  return {
    from: comparisonStart,
    to: comparisonEnd,
  };
}
