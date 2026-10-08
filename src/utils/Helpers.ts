import type { ClassValue } from "clsx";
import type { TFunction } from "i18next";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { User } from "@/types/User";

/** Merges Tailwind class names; later classes win over conflicting earlier ones. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parses a math-svr timestamp ("20261003101500.000000", Go layout
 * "20060102150405.000000", always UTC). Returns null when the value is
 * missing or not in that shape.
 */
export function parseServerTime(value: string | null | undefined): Date | null {
  const match = value?.match(
    /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\.(\d{1,6}))?$/,
  );
  if (!match) return null;
  const [, year, month, day, hour, minute, second, fraction = "0"] = match;
  const millis = Number(fraction.padEnd(3, "0").slice(0, 3));
  return new Date(
    Date.UTC(+year, +month - 1, +day, +hour, +minute, +second, millis),
  );
}

/**
 * Canonical E.164 phone, mirroring math-svr utils.NormalizePhone
 * ("0912 345 678" → "+84912345678"). Returns null when the server would
 * reject it. /users/update stores the phone as sent and login looks it up
 * normalized, so always send this form.
 */
export function normalizePhone(value: string): string | null {
  const cleaned = value.trim().replace(/[\s\-().]/g, "");
  if (/^0\d{9}$/.test(cleaned)) return `+84${cleaned.slice(1)}`;
  if (/^84\d{9}$/.test(cleaned)) return `+${cleaned}`;
  if (/^\+\d{8,15}$/.test(cleaned)) return cleaned;
  return null;
}

/** "Nguyễn Minh Anh" → "MA" (Vietnamese names put the given name last). */
export function initialsOf(name: string): string {
  // First letter of each word, skipping punctuation such as "(" or "#".
  return name
    .split(/\s+/)
    .map((word) => word.match(/[\p{L}\p{N}]/u)?.[0] ?? "")
    .filter(Boolean)
    .slice(-2)
    .join("")
    .toUpperCase();
}

/**
 * Parses an RFC 3339 time as Go's time.Time encodes it ("2026-10-04T10:00:00.123456789+07:00").
 * The admin-only routes (jobs, sessions, db stats) send these instead of the
 * "20060102150405" layout. Fractions are cut to milliseconds, which every browser parses.
 */
export function parseIsoTime(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value.replace(/(\.\d{3})\d+/, "$1"));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Local date + time in the UI locale (vi: "09:14 02/10/2026"), or "—" when missing. */
export function formatDateTime(date: Date | null, locale: string, withSeconds = false): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: withSeconds ? "2-digit" : undefined,
    hour12: false,
  }).format(date);
}

/** A math-svr timestamp as local date + time in the UI locale, or "—" when missing. */
export function formatServerTime(value: string | null | undefined, locale: string): string {
  return formatDateTime(parseServerTime(value), locale);
}

/** The name to show for an account; guests often have none. */
export function userDisplayName(user: User, t: TFunction): string {
  return (
    user.name.trim() ||
    (user.role === null
      ? t("users.guestName")
      : user.phone || user.email || `#${user.uid}`)
  );
}

/** UTF-8 size of a string — the unit math-svr uses for its length limits. */
export function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/** Same pattern as math-svr utils.ValidateEmail. */
export function isValidEmail(value: string): boolean {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value);
}
