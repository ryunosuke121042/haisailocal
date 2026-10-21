import { describe, expect, it } from 'vitest';
import { bookingCloseAt, cancelTerms, cleanSlots, dayAvailability, dayLevel, freeCancelUntil, type BookingConfig } from '../shared/booking';
import { jstToDate } from '../shared/time';

const cfg = (p: Partial<BookingConfig> = {}): BookingConfig => ({
  slots: [
    { time: '10:00', capacity: 6 },
    { time: '14:00', capacity: 4 },
  ],
  closedWeekdays: [],
  closedDates: [],
  cutoff: 'SAME_DAY',
  ...p,
});

// 2026-10-20 は火曜日
const NOW = jstToDate('2026-10-20', '09:00');

describe('dayAvailability', () => {
  it('opens slots with remaining seats', () => {
    const r = dayAvailability(cfg(), '2026-10-22', new Map([['10:00', 4]]), NOW);
    expect(r.state).toBe('open');
    expect(r.slots).toEqual([
      { time: '10:00', capacity: 6, remaining: 2, open: true },
      { time: '14:00', capacity: 4, remaining: 4, open: true },
    ]);
  });

  it('is full when every slot is booked up', () => {
    const r = dayAvailability(cfg(), '2026-10-22', new Map([['10:00', 6], ['14:00', 4]]), NOW);
    expect(r.state).toBe('full');
    expect(r.slots.every((s) => !s.open)).toBe(true);
  });

  it('respects closed weekdays and closed dates', () => {
    expect(dayAvailability(cfg({ closedWeekdays: [4] }), '2026-10-22', new Map(), NOW).state).toBe('closedWeekday');
    expect(dayAvailability(cfg({ closedDates: ['2026-10-22'] }), '2026-10-22', new Map(), NOW).state).toBe('closedDate');
  });

  it('closes same-day slots once the start time has passed', () => {
    const r = dayAvailability(cfg(), '2026-10-20', new Map(), jstToDate('2026-10-20', '11:00'));
    expect(r.state).toBe('open');
    expect(r.slots.map((s) => s.open)).toEqual([false, true]);
    expect(dayAvailability(cfg(), '2026-10-20', new Map(), jstToDate('2026-10-20', '15:00')).state).toBe('past');
  });

  it('applies the "day before" and "2 days before" cutoffs', () => {
    expect(dayAvailability(cfg({ cutoff: 'DAY_BEFORE' }), '2026-10-20', new Map(), NOW).state).toBe('past');
    expect(dayAvailability(cfg({ cutoff: 'DAY_BEFORE' }), '2026-10-21', new Map(), NOW).state).toBe('open');
    expect(dayAvailability(cfg({ cutoff: 'TWO_DAYS_BEFORE' }), '2026-10-21', new Map(), NOW).state).toBe('cutoff');
    expect(dayAvailability(cfg({ cutoff: 'TWO_DAYS_BEFORE' }), '2026-10-22', new Map(), NOW).state).toBe('open');
  });

  it('cannot book past dates, too far ahead, or without slots', () => {
    expect(dayAvailability(cfg(), '2026-10-19', new Map(), NOW).state).toBe('past');
    expect(dayAvailability(cfg(), '2027-01-30', new Map(), NOW).state).toBe('tooFar');
    expect(dayAvailability(cfg({ slots: [] }), '2026-10-22', new Map(), NOW).state).toBe('noSlots');
  });
});

describe('deadlines', () => {
  it('computes booking close times in JST', () => {
    expect(bookingCloseAt('SAME_DAY', '2026-10-22', '10:00').toISOString()).toBe('2026-10-22T01:00:00.000Z');
    expect(bookingCloseAt('DAY_BEFORE', '2026-10-22', '10:00').toISOString()).toBe('2026-10-21T15:00:00.000Z');
    expect(bookingCloseAt('TWO_DAYS_BEFORE', '2026-10-22', '10:00').toISOString()).toBe('2026-10-20T15:00:00.000Z');
  });

  it('computes free cancellation deadlines (end of the day before / 3 days before)', () => {
    expect(freeCancelUntil('SAME_DAY', '2026-10-22', '10:00')).toEqual(jstToDate('2026-10-22', '10:00'));
    expect(freeCancelUntil('DAY_BEFORE', '2026-10-22', '10:00')).toEqual(jstToDate('2026-10-22', '00:00'));
    expect(freeCancelUntil('THREE_DAYS_BEFORE', '2026-10-22', '10:00')).toEqual(jstToDate('2026-10-20', '00:00'));
  });
});

describe('cancelTerms', () => {
  const base = { freeCancel: 'DAY_BEFORE' as const, lateFeeJpy: 2000, date: '2026-10-22', time: '18:00', partySize: 3 };
  it('is free before the deadline', () => {
    expect(cancelTerms(base, jstToDate('2026-10-21', '23:59'))).toMatchObject({ late: false, feeJpy: 0 });
  });
  it('charges the per-person fee after the deadline', () => {
    expect(cancelTerms(base, jstToDate('2026-10-22', '00:00'))).toMatchObject({ late: true, feeJpy: 6000 });
  });
  it('is late but free when the shop has no fee', () => {
    expect(cancelTerms({ ...base, lateFeeJpy: null }, jstToDate('2026-10-22', '12:00'))).toMatchObject({ late: true, feeJpy: 0 });
  });
});

describe('cleanSlots', () => {
  it('drops invalid and duplicate times, clamps capacity and sorts', () => {
    expect(
      cleanSlots([
        { time: '14:00', capacity: 4 },
        { time: '9:00', capacity: 2 },
        { time: '10:00', capacity: 0 },
        { time: '14:00', capacity: 8 },
        { time: '25:00', capacity: 3 },
        { time: '11:30', capacity: 999 },
      ]),
    ).toEqual([
      { time: '10:00', capacity: 1 },
      { time: '11:30', capacity: 50 },
      { time: '14:00', capacity: 4 },
    ]);
  });
});

describe('dayLevel（一覧のカードの空き具合）', () => {
  const slot = (capacity: number, remaining: number, open = true) => ({ time: '10:00', capacity, remaining, open });
  it('空きの量で ○ △ を分け、満席・休みを区別する', () => {
    expect(dayLevel({ state: 'open', slots: [slot(6, 6), slot(6, 5)] })).toBe('open');
    expect(dayLevel({ state: 'open', slots: [slot(6, 2), slot(6, 0, false)] })).toBe('few');
    expect(dayLevel({ state: 'open', slots: [slot(20, 5), slot(20, 0, false)] })).toBe('few');
    expect(dayLevel({ state: 'full', slots: [slot(6, 0, false)] })).toBe('full');
    expect(dayLevel({ state: 'cutoff', slots: [slot(6, 6, false)] })).toBe('full');
    expect(dayLevel({ state: 'closedWeekday', slots: [] })).toBe('closed');
    expect(dayLevel({ state: 'tooFar', slots: [] })).toBe('closed');
  });
});
