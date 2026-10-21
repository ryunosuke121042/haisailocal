// 日本時間（UTC+9、サマータイムなし）の日付・時刻を扱う
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function jstDateString(d: Date = new Date()): string {
  return new Date(d.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

export function jstTimeString(d: Date): string {
  return new Date(d.getTime() + JST_OFFSET_MS).toISOString().slice(11, 16);
}

/** "2026-10-12" と "18:30"（日本時間）から Date を作る */
export function jstToDate(date: string, time: string): Date {
  return new Date(`${date}T${time}:00+09:00`);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 日本時間の暦日で、from から to まで何日あるか（to が来店日） */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function isValidDateString(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

export function isValidTimeString(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}
