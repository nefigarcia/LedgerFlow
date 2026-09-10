import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  endOfYear,
  format,
  isAfter,
  isBefore,
  isValid,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfYear,
  subMonths,
} from "date-fns";

export {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  endOfYear,
  format,
  isAfter,
  isBefore,
  isValid,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfYear,
  subMonths,
};

export function todayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function parseDateOnly(input: string | Date): Date {
  if (input instanceof Date) return input;
  // Force to noon UTC to sidestep TZ shifting for date-only fields
  const iso = input.length === 10 ? `${input}T12:00:00.000Z` : input;
  return new Date(iso);
}

export function formatDate(date: Date | string, pattern = "MMM d, yyyy"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (!isValid(d)) return "—";
  return format(d, pattern);
}

export function formatDateISO(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "yyyy-MM-dd");
}

export function isOverdue(dueDate: Date | string, referenceDate?: Date): boolean {
  const d = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  const ref = referenceDate ?? new Date();
  return isBefore(endOfDay(d), startOfDay(ref));
}

export function daysUntil(date: Date | string): number {
  const d = typeof date === "string" ? new Date(date) : date;
  return differenceInCalendarDays(d, new Date());
}

export function monthKey(date: Date): string {
  return format(date, "yyyy-MM");
}

export function lastNMonths(n: number, from = new Date()): Date[] {
  const months: Date[] = [];
  for (let i = n - 1; i >= 0; i--) {
    months.push(startOfMonth(subMonths(from, i)));
  }
  return months;
}

/**
 * Generate US federal quarterly estimated tax payment dates for a year.
 * These are approximate defaults — they must be editable.
 */
export function usQuarterlyTaxDates(year: number): Date[] {
  return [
    new Date(Date.UTC(year, 3, 15)),  // Apr 15
    new Date(Date.UTC(year, 5, 15)),  // Jun 15
    new Date(Date.UTC(year, 8, 15)),  // Sep 15
    new Date(Date.UTC(year + 1, 0, 15)), // Jan 15 next year
  ];
}
