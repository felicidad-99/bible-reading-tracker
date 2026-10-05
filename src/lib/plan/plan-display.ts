import { formatChapterRange } from "./generator";

export interface PlanDayLite {
  date: string;
  dayNumber: number;
  status: string;
  sessions?: Array<{
    chapters: Array<{ bookId: string; bookName: string; start: number; end: number }>;
  }>;
}

export function localToday(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function progressOf(plan: {
  startDate: string;
  durationDays: number;
  days: Array<{ date: string; dayNumber: number; status: string }>;
}): { currentDay: number; percent: number } {
  const today = localToday();
  const completed = plan.days.filter((d) => d.status === "completed").length;
  const byDate = plan.days.find((d) => d.date === today);
  let currentDay = byDate?.dayNumber;
  if (currentDay === undefined) {
    const start = Date.parse(`${plan.startDate}T00:00:00Z`);
    const now = Date.parse(`${today}T00:00:00Z`);
    const elapsed = Math.floor((now - start) / 86_400_000) + 1;
    currentDay = Math.min(Math.max(elapsed, 1), plan.durationDays);
  }
  const percent =
    plan.durationDays > 0
      ? Math.round((completed / plan.durationDays) * 100)
      : 0;
  return { currentDay, percent };
}

/** "Joshua 1-4 & Psalm 74" for today, or null when there is no entry. */
export function todayReadingText(days: PlanDayLite[]): string | null {
  const today = localToday();
  const day = days.find((d) => d.date === today);
  if (!day || !day.sessions?.length) return null;
  const parts: string[] = [];
  for (const session of day.sessions) {
    for (const range of session.chapters) {
      parts.push(formatChapterRange(range));
    }
  }
  return parts.length ? parts.join(" & ") : null;
}
