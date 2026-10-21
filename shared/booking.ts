// 予約できる枠とキャンセル期限の計算（サーバーと画面で共有し、テストする）
import { LIMITS, type CutoffCode, type FreeCancelCode } from './constants.js';
import { addDays, daysBetween, jstDateString, jstToDate } from './time.js';

export interface Slot {
  time: string; // 開始時刻 HH:MM（日本時間）
  capacity: number; // 枠ごとの上限人数
}

export interface BookingConfig {
  slots: Slot[];
  closedWeekdays: number[]; // 0=日 … 6=土
  closedDates: string[]; // 受付停止日 YYYY-MM-DD
  cutoff: CutoffCode;
}

export type DayState = 'open' | 'full' | 'past' | 'tooFar' | 'closedWeekday' | 'closedDate' | 'cutoff' | 'noSlots';

export interface SlotState extends Slot {
  remaining: number;
  open: boolean; // 受付締切前で、残りがある
}

export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** この枠の予約を受け付ける最後の時刻 */
export function bookingCloseAt(cutoff: CutoffCode, date: string, time: string): Date {
  switch (cutoff) {
    case 'SAME_DAY':
      return jstToDate(date, time);
    case 'DAY_BEFORE':
      return jstToDate(date, '00:00');
    case 'TWO_DAYS_BEFORE':
      return jstToDate(addDays(date, -1), '00:00');
  }
}

/** 無料でキャンセルできる最後の時刻（「前日まで」なら前日の23:59まで） */
export function freeCancelUntil(policy: FreeCancelCode, date: string, time: string): Date {
  switch (policy) {
    case 'SAME_DAY':
      return jstToDate(date, time);
    case 'DAY_BEFORE':
      return jstToDate(date, '00:00');
    case 'THREE_DAYS_BEFORE':
      return jstToDate(addDays(date, -2), '00:00');
  }
}

/**
 * ある日の枠の状態。booked は時刻ごとの確定済み人数。
 * 定休日・受付停止日・受付締切・満席の日は選べない。
 */
export function dayAvailability(cfg: BookingConfig, date: string, booked: Map<string, number>, now = new Date()): { state: DayState; slots: SlotState[] } {
  const today = jstDateString(now);
  const ahead = daysBetween(today, date);
  if (!cfg.slots.length) return { state: 'noSlots', slots: [] };
  if (ahead < 0) return { state: 'past', slots: [] };
  if (ahead > LIMITS.bookingDaysAhead) return { state: 'tooFar', slots: [] };
  if (cfg.closedWeekdays.includes(weekdayOf(date))) return { state: 'closedWeekday', slots: [] };
  if (cfg.closedDates.includes(date)) return { state: 'closedDate', slots: [] };
  const slots = [...cfg.slots]
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((s) => {
      const remaining = Math.max(0, s.capacity - (booked.get(s.time) ?? 0));
      const beforeCutoff = now.getTime() < bookingCloseAt(cfg.cutoff, date, s.time).getTime();
      return { ...s, remaining, open: beforeCutoff && remaining > 0 };
    });
  if (slots.some((s) => s.open)) return { state: 'open', slots };
  const anyBeforeCutoff = slots.some((s) => now.getTime() < bookingCloseAt(cfg.cutoff, date, s.time).getTime());
  return { state: anyBeforeCutoff ? 'full' : ahead === 0 ? 'past' : 'cutoff', slots };
}

/** 一覧のカードに出す、その日のおおよその空き具合 */
export type DayLevel = 'open' | 'few' | 'full' | 'closed';

/** 空きあり／残りわずか（残り2人以下か、全体の3割以下）／満席・締め切り／休み・予約できない日 */
export function dayLevel(day: { state: DayState; slots: SlotState[] }): DayLevel {
  if (day.state === 'full' || day.state === 'cutoff') return 'full';
  if (day.state !== 'open') return 'closed';
  const left = day.slots.filter((s) => s.open).reduce((n, s) => n + s.remaining, 0);
  const total = day.slots.reduce((n, s) => n + s.capacity, 0);
  return left <= 2 || left <= total * 0.3 ? 'few' : 'open';
}

/** いまキャンセルしたら期限後か。期限後で、キャンセル料ありなら金額（1人あたり×人数） */
export function cancelTerms(
  input: { freeCancel: FreeCancelCode; lateFeeJpy: number | null; date: string; time: string; partySize: number },
  now = new Date(),
): { late: boolean; feeJpy: number; deadline: Date } {
  const deadline = freeCancelUntil(input.freeCancel, input.date, input.time);
  const late = now.getTime() >= deadline.getTime();
  return { late, feeJpy: late && input.lateFeeJpy ? input.lateFeeJpy * input.partySize : 0, deadline };
}

/** 枠の設定を整える（時刻の重複を除き、上限人数を丸める） */
export function cleanSlots(raw: Slot[]): Slot[] {
  const seen = new Set<string>();
  return raw
    .filter((s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s.time) && !seen.has(s.time) && seen.add(s.time))
    .map((s) => ({ time: s.time, capacity: Math.max(1, Math.min(LIMITS.slotCapacityMax, Math.round(s.capacity))) }))
    .sort((a, b) => a.time.localeCompare(b.time))
    .slice(0, LIMITS.slotsMax);
}
