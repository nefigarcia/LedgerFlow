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

/**
 * Today's calendar date ("yyyy-MM-dd") in the given IANA timezone. Use this
 * for date-input defaults so a user in Los Angeles at 8pm doesn't get
 * tomorrow's (UTC) date.
 */
export function todayISOInTimeZone(timeZone?: string | null, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** Add whole days to a "yyyy-MM-dd" string without timezone drift. */
export function addDaysISO(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Date-only value (stored at noon UTC) → "yyyy-MM-dd" for <input type="date">. */
export function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
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
