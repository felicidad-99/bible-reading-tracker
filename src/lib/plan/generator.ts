import {
  getFlatChapters,
  TOTAL_CHAPTERS,
  type FlatChapter,
} from "./bible-books";
import { addDays, format, parseISO } from "date-fns";

export type Frequency = 1 | 2 | 3;

export interface ChapterRange {
  bookId: string;
  bookName: string;
  start: number;
  end: number;
}

export interface PlanSession {
  sessionNumber: number;
  scheduledTime: string;
  chapters: ChapterRange[];
  chapterCount: number;
}

export interface PlanDay {
  dayNumber: number;
  date: string;
  sessions: PlanSession[];
  totalChapters: number;
}

export interface GeneratePlanInput {
  startDate: string;
  durationDays: number;
  frequency: Frequency;
  totalChapters?: number;
}

export interface GeneratePlanResult {
  startDate: string;
  endDate: string;
  durationDays: number;
  frequency: Frequency;
  totalChapters: number;
  days: PlanDay[];
  chaptersPerDayBase: number;
  chaptersPerDayRemainder: number;
}

const DEFAULT_TIMES: Record<Frequency, string[]> = {
  1: ["07:00"],
  2: ["07:00", "20:00"],
  3: ["07:00", "13:00", "20:00"],
};

/**
 * Largest-remainder distribution: splits `total` items into `buckets` groups
 * as evenly as possible. First `remainder` buckets get one extra item.
 * Guarantees sum === total and max-min <= 1.
 */
export function distributeEvenly(total: number, buckets: number): number[] {
  if (buckets <= 0) return [];
  if (total <= 0) return Array(buckets).fill(0);

  const base = Math.floor(total / buckets);
  const remainder = total % buckets;
  const result: number[] = [];
  for (let i = 0; i < buckets; i++) {
    result.push(i < remainder ? base + 1 : base);
  }
  return result;
}

export function chunkChapters(
  chapters: FlatChapter[],
  counts: number[]
): FlatChapter[][] {
  const chunks: FlatChapter[][] = [];
  let cursor = 0;
  for (const count of counts) {
    chunks.push(chapters.slice(cursor, cursor + count));
    cursor += count;
  }
  return chunks;
}

export function chaptersToRanges(chunk: FlatChapter[]): ChapterRange[] {
  if (chunk.length === 0) return [];

  const ranges: ChapterRange[] = [];
  let currentBook = chunk[0].bookId;
  let currentName = chunk[0].bookName;
  let start = chunk[0].chapter;
  let end = chunk[0].chapter;

  for (let i = 1; i < chunk.length; i++) {
    const ch = chunk[i];
    const prev = chunk[i - 1];
    const sameBook = ch.bookId === prev.bookId;
    const consecutive = ch.chapter === prev.chapter + 1;

    if (sameBook && consecutive) {
      end = ch.chapter;
    } else {
      ranges.push({ bookId: currentBook, bookName: currentName, start, end });
      currentBook = ch.bookId;
      currentName = ch.bookName;
      start = ch.chapter;
      end = ch.chapter;
    }
  }
  ranges.push({ bookId: currentBook, bookName: currentName, start, end });
  return ranges;
}

export function formatChapterRange(range: ChapterRange): string {
  return range.start === range.end
    ? `${range.bookName} ${range.start}`
    : `${range.bookName} ${range.start}-${range.end}`;
}

export function formatSessionReading(session: PlanSession): string {
  return session.chapters.map(formatChapterRange).join(", ");
}

export function validatePlanInput(input: GeneratePlanInput): void {
  if (!input.startDate || Number.isNaN(parseISO(input.startDate).getTime())) {
    throw new Error("Invalid start date");
  }
  if (!Number.isInteger(input.durationDays) || input.durationDays < 1) {
    throw new Error("Duration must be a positive integer of days");
  }
  if (input.durationDays > 3650) {
    throw new Error("Duration cannot exceed 10 years");
  }
  if (![1, 2, 3].includes(input.frequency)) {
    throw new Error("Frequency must be 1, 2, or 3 sessions per day");
  }
}

export function generateReadingPlan(
  input: GeneratePlanInput
): GeneratePlanResult {
  validatePlanInput(input);

  const totalChapters = input.totalChapters ?? TOTAL_CHAPTERS;
  const flat = getFlatChapters().slice(0, totalChapters);

  if (flat.length !== totalChapters) {
    throw new Error(
      `Chapter catalog has ${flat.length} chapters, expected ${totalChapters}`
    );
  }

  const { startDate, durationDays, frequency } = input;
  const start = parseISO(startDate);
  const dayCounts = distributeEvenly(flat.length, durationDays);
  const perDayChunks = chunkChapters(flat, dayCounts);
  const times = DEFAULT_TIMES[frequency];

  const days: PlanDay[] = perDayChunks.map((dayChapters, i) => {
    const sessionCounts = distributeEvenly(dayChapters.length, frequency);
    const sessionChunks = chunkChapters(dayChapters, sessionCounts);

    const sessions: PlanSession[] = sessionChunks.map((sessionChapters, si) => ({
      sessionNumber: si + 1,
      scheduledTime: times[si],
      chapters: chaptersToRanges(sessionChapters),
      chapterCount: sessionChapters.length,
    }));

    const date = addDays(start, i);
    return {
      dayNumber: i + 1,
      date: format(date, "yyyy-MM-dd"),
      sessions,
      totalChapters: dayChapters.length,
    };
  });

  const endDate = format(addDays(start, durationDays - 1), "yyyy-MM-dd");

  return {
    startDate,
    endDate,
    durationDays,
    frequency,
    totalChapters: flat.length,
    days,
    chaptersPerDayBase: Math.floor(flat.length / durationDays),
    chaptersPerDayRemainder: flat.length % durationDays,
  };
}

/**
 * Regenerate only future/incomplete days while preserving completed history.
 * Returns new full day list where completed days are left untouched.
 */
export function regenerateRemainingPlan(
  existingDays: Array<{
    dayNumber: number;
    date: string;
    status: string;
    sessions: PlanSession[];
    totalChapters: number;
  }>,
  input: GeneratePlanInput
): PlanDay[] {
  validatePlanInput(input);

  const fresh = generateReadingPlan(input);
  const completedByDay = new Map(
    existingDays
      .filter((d) => d.status === "completed")
      .map((d) => [d.dayNumber, d])
  );

  return fresh.days.map((day) => {
    const preserved = completedByDay.get(day.dayNumber);
    if (preserved) {
      return {
        dayNumber: day.dayNumber,
        date: preserved.date,
        sessions: preserved.sessions,
        totalChapters: preserved.totalChapters,
      };
    }
    return day;
  });
}

export function computeSessionStatus(
  scheduledDate: string,
  scheduledTime: string,
  completed: boolean,
  now: Date = new Date()
): "not_started" | "in_progress" | "completed" | "missed" {
  if (completed) return "completed";

  const [h, m] = scheduledTime.split(":").map(Number);
  const scheduled = parseISO(scheduledDate);
  scheduled.setHours(h, m, 0, 0);

  if (now > scheduled) {
    const overdueMs = now.getTime() - scheduled.getTime();
    const graceMs = 60 * 60 * 1000;
    if (overdueMs > graceMs) return "missed";
    return "in_progress";
  }
  return "not_started";
}

export function computeDayStatus(
  day: { sessions: Array<{ completed: boolean; scheduledTime: string }>; date: string },
  now: Date = new Date()
): "not_started" | "in_progress" | "completed" | "missed" {
  const completedCount = day.sessions.filter((s) => s.completed).length;
  if (completedCount === day.sessions.length && day.sessions.length > 0) {
    return "completed";
  }

  const statuses = day.sessions.map((s) =>
    computeSessionStatus(day.date, s.scheduledTime, s.completed, now)
  );

  if (statuses.some((s) => s === "missed")) return "missed";
  if (completedCount > 0 || statuses.some((s) => s === "in_progress")) {
    return "in_progress";
  }
  if (statuses.every((s) => s === "completed")) return "completed";
  return "not_started";
}

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
}

export function calculateStreaks(
  completedDates: string[],
  today: string = format(new Date(), "yyyy-MM-dd")
): StreakResult {
  const unique = Array.from(new Set(completedDates)).sort();
  if (unique.length === 0) return { currentStreak: 0, longestStreak: 0 };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < unique.length; i++) {
    const prev = parseISO(unique[i - 1]);
    const curr = parseISO(unique[i]);
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
    if (diffDays === 1) {
      run++;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }

  const set = new Set(unique);
  let current = 0;
  let cursor = parseISO(today);
  if (!set.has(today)) {
    cursor = addDays(cursor, -1);
    if (!set.has(format(cursor, "yyyy-MM-dd"))) {
      return { currentStreak: 0, longestStreak: longest };
    }
  }
  while (set.has(format(cursor, "yyyy-MM-dd"))) {
    current++;
    cursor = addDays(cursor, -1);
  }

  return { currentStreak: current, longestStreak: Math.max(longest, current) };
}

export function catchUpRedistribute(
  missedChapters: number,
  remainingDays: PlanDay[]
): { days: PlanDay[]; addedPerDay: number[] } {
  if (remainingDays.length === 0 || missedChapters <= 0) {
    return { days: remainingDays, addedPerDay: [] };
  }

  const extra = distributeEvenly(missedChapters, remainingDays.length);
  const flat = getFlatChapters();

  const days = remainingDays.map((day, i) => {
    const add = extra[i];
    if (add === 0) return day;

    const sessionCounts = distributeEvenly(
      day.totalChapters + add,
      day.sessions.length
    );

    const dayStartIdx = flat.findIndex(
      (c) =>
        c.bookId === day.sessions[0]?.chapters[0]?.bookId &&
        c.chapter === day.sessions[0]?.chapters[0]?.start
    );

    const allDayChapters = flat.slice(dayStartIdx, dayStartIdx + day.totalChapters + add);
    const sessionChunks = chunkChapters(allDayChapters, sessionCounts);

    const sessions: PlanSession[] = sessionChunks.map((sessionChapters, si) => ({
      sessionNumber: si + 1,
      scheduledTime: day.sessions[si]?.scheduledTime ?? DEFAULT_TIMES[day.sessions.length as Frequency][si] ?? "07:00",
      chapters: chaptersToRanges(sessionChapters),
      chapterCount: sessionChapters.length,
    }));

    return {
      ...day,
      sessions,
      totalChapters: day.totalChapters + add,
    };
  });

  return { days, addedPerDay: extra };
}
