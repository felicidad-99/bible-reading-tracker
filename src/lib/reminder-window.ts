export type ReminderKind = "before" | "missed";

export interface ReminderPrefs {
  enabled: boolean;
  beforeMinutes: number;
  missedReminderEnabled: boolean;
  missedAfterMinutes: number;
  maxMissedPerSession: number;
}

export interface SessionSnapshot {
  sessionId: string;
  scheduledDate: string;
  scheduledTime: string;
  completed: boolean;
}

export interface ReminderDue {
  kind: ReminderKind;
  minutesUntil?: number;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{1,2}):(\d{2})$/;

function zoneFormatter(timeZone: string): Intl.DateTimeFormat | null {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return null;
  }
}

function zoneOffsetMs(timeZone: string, at: Date): number {
  const fmt = zoneFormatter(timeZone);
  if (!fmt) return 0;
  const parts = fmt.formatToParts(at);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

export function zonedToUtc(
  dateStr: string,
  timeStr: string,
  timeZone: string
): Date | null {
  const d = DATE_RE.exec(dateStr);
  const t = TIME_RE.exec(timeStr);
  if (!d || !t) return null;
  const [y, mo, day] = [Number(d[1]), Number(d[2]), Number(d[3])];
  const [h, mi] = [Number(t[1]), Number(t[2])];
  if (mo < 1 || mo > 12 || day < 1 || day > 31 || h > 23 || mi > 59) return null;

  const naive = Date.UTC(y, mo - 1, day, h, mi);
  const offset1 = zoneOffsetMs(timeZone, new Date(naive));
  const candidate1 = naive - offset1;
  const offset2 = zoneOffsetMs(timeZone, new Date(candidate1));
  if (offset2 === offset1) return new Date(candidate1);
  return new Date(naive - offset2);
}

export function localDateKey(date: Date, timeZone: string): string {
  const fmt = zoneFormatter(timeZone);
  if (!fmt) return date.toISOString().slice(0, 10);
  return fmt.format(date).slice(0, 10);
}

export function previousDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

export function reminderDue(args: {
  session: SessionSnapshot;
  prefs: ReminderPrefs;
  now: Date;
  timezone?: string;
  sentBefore: boolean;
  sentMissed: boolean;
}): ReminderDue | null {
  const { session, prefs, now, sentBefore, sentMissed } = args;
  const timezone = args.timezone || "UTC";
  if (session.completed) return null;

  const scheduled = zonedToUtc(
    session.scheduledDate,
    session.scheduledTime,
    timezone
  );
  if (!scheduled) return null;

  const deltaMs = scheduled.getTime() - now.getTime();

  if (
    prefs.enabled &&
    !sentBefore &&
    deltaMs > 0 &&
    deltaMs <= prefs.beforeMinutes * 60_000
  ) {
    return {
      kind: "before",
      minutesUntil: Math.max(1, Math.round(deltaMs / 60_000)),
    };
  }

  if (
    prefs.missedReminderEnabled &&
    prefs.maxMissedPerSession >= 1 &&
    !sentMissed &&
    -deltaMs > prefs.missedAfterMinutes * 60_000
  ) {
    return { kind: "missed" };
  }

  return null;
}

export function sessionLabel(n: number): string {
  return n === 1 ? "morning" : n === 2 ? "afternoon" : "evening";
}

export function formatChapters(chapters: unknown): string {
  if (!Array.isArray(chapters) || chapters.length === 0) return "your reading";
  return chapters
    .map((c) => {
      const r = c as { bookName?: string; bookId?: string; start: number; end: number };
      const name = r.bookName ?? r.bookId ?? "";
      return r.start === r.end
        ? `${name} ${r.start}`
        : `${name} ${r.start}-${r.end}`;
    })
    .join(", ");
}
