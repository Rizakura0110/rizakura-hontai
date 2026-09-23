export const TECH_INBOX_ACTIVITY_TIME_ZONE = "Asia/Tokyo" as const;
export const TECH_INBOX_ACTIVITY_WINDOW_DAYS = 365;

const DAY_MILLISECONDS = 24 * 60 * 60 * 1_000;
const TOKYO_OFFSET_MILLISECONDS = 9 * 60 * 60 * 1_000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

export type ActivityDate = string;

export type ReadActivityDayCount = {
  readonly date: ActivityDate;
  readonly count: number;
};

export type ReadActivityWindow = {
  readonly startDate: ActivityDate;
  readonly endDate: ActivityDate;
  readonly startAt: string;
  readonly endAtExclusive: string;
};

export type ReadActivitySnapshot = {
  readonly totalReadCount: number;
  readonly days: readonly ReadActivityDayCount[];
};

export type ReadActivitySummary = {
  readonly timeZone: typeof TECH_INBOX_ACTIVITY_TIME_ZONE;
  readonly startDate: ActivityDate;
  readonly endDate: ActivityDate;
  readonly totalReadCount: number;
  readonly currentMonthReadCount: number;
  readonly currentStreakDays: number;
  readonly days: readonly ReadActivityDayCount[];
};

function dateValue(date: ActivityDate): number {
  if (!DATE_PATTERN.test(date)) throw new Error("Activity date must use YYYY-MM-DD.");
  const value = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(value) || new Date(value).toISOString().slice(0, 10) !== date) {
    throw new Error("Activity date must be a real calendar date.");
  }
  return value;
}

export function addActivityDays(date: ActivityDate, amount: number): ActivityDate {
  if (!Number.isInteger(amount)) throw new Error("Activity date offset must be an integer.");
  return new Date(dateValue(date) + amount * DAY_MILLISECONDS).toISOString().slice(0, 10);
}

export function activityDateInTokyo(instant: Date): ActivityDate {
  const value = instant.getTime();
  if (!Number.isFinite(value)) throw new Error("Activity clock must return a valid instant.");
  return new Date(value + TOKYO_OFFSET_MILLISECONDS).toISOString().slice(0, 10);
}

function tokyoDayStart(date: ActivityDate): string {
  return new Date(dateValue(date) - TOKYO_OFFSET_MILLISECONDS).toISOString();
}

export function createReadActivityWindow(now: Date): ReadActivityWindow {
  const endDate = activityDateInTokyo(now);
  const startDate = addActivityDays(endDate, -(TECH_INBOX_ACTIVITY_WINDOW_DAYS - 1));
  return {
    startDate,
    endDate,
    startAt: tokyoDayStart(startDate),
    endAtExclusive: tokyoDayStart(addActivityDays(endDate, 1)),
  };
}

function assertSnapshot(snapshot: ReadActivitySnapshot, window: ReadActivityWindow): void {
  if (!Number.isInteger(snapshot.totalReadCount) || snapshot.totalReadCount < 0) {
    throw new Error("Total read count must be a non-negative integer.");
  }
  const dates = new Set<ActivityDate>();
  let windowCount = 0;
  for (const day of snapshot.days) {
    dateValue(day.date);
    if (day.date < window.startDate || day.date > window.endDate) {
      throw new Error("Activity snapshot contains a date outside its window.");
    }
    if (!Number.isInteger(day.count) || day.count <= 0) {
      throw new Error("Stored activity counts must be positive integers.");
    }
    if (dates.has(day.date)) throw new Error("Activity snapshot contains a duplicate date.");
    dates.add(day.date);
    windowCount += day.count;
  }
  if (windowCount > snapshot.totalReadCount) {
    throw new Error("Activity window count must not exceed the total read count.");
  }
}

export function summarizeReadActivity(
  window: ReadActivityWindow,
  snapshot: ReadActivitySnapshot,
): ReadActivitySummary {
  assertSnapshot(snapshot, window);
  const storedCounts = new Map(snapshot.days.map((day) => [day.date, day.count]));
  const days = Array.from({ length: TECH_INBOX_ACTIVITY_WINDOW_DAYS }, (_, index) => {
    const date = addActivityDays(window.startDate, index);
    return { date, count: storedCounts.get(date) ?? 0 };
  });
  if (days.at(-1)?.date !== window.endDate) {
    throw new Error("Activity window must contain exactly 365 consecutive days.");
  }

  const currentMonth = window.endDate.slice(0, 7);
  const currentMonthReadCount = days.reduce(
    (total, day) => total + (day.date.startsWith(currentMonth) ? day.count : 0),
    0,
  );
  const countByDate = new Map(days.map((day) => [day.date, day.count]));
  let cursor = window.endDate;
  if ((countByDate.get(cursor) ?? 0) === 0) cursor = addActivityDays(cursor, -1);
  let currentStreakDays = 0;
  while (cursor >= window.startDate && (countByDate.get(cursor) ?? 0) > 0) {
    currentStreakDays += 1;
    cursor = addActivityDays(cursor, -1);
  }

  return {
    timeZone: TECH_INBOX_ACTIVITY_TIME_ZONE,
    startDate: window.startDate,
    endDate: window.endDate,
    totalReadCount: snapshot.totalReadCount,
    currentMonthReadCount,
    currentStreakDays,
    days,
  };
}
