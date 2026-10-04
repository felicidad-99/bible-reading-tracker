import { describe, it, expect } from "vitest";
import {
  reminderDue,
  zonedToUtc,
  localDateKey,
  previousDateKey,
  formatChapters,
  sessionLabel,
  type ReminderPrefs,
} from "@/lib/reminder-window";

const prefs = (over: Partial<ReminderPrefs> = {}): ReminderPrefs => ({
  enabled: true,
  beforeMinutes: 15,
  missedReminderEnabled: true,
  missedAfterMinutes: 45,
  maxMissedPerSession: 1,
  ...over,
});

const base = {
  sessionId: "s1",
  scheduledDate: "2026-10-05",
  scheduledTime: "07:00",
  completed: false,
};

function at(iso: string): Date {
  return new Date(iso);
}

describe("reminderDue", () => {
  it("returns before-reminder inside the pre-session window", () => {
    const due = reminderDue({
      session: base,
      prefs: prefs(),
      now: at("2026-10-05T06:50:00Z"),
      timezone: "UTC",
      sentBefore: false,
      sentMissed: false,
    });
    expect(due).toEqual({ kind: "before", minutesUntil: 10 });
  });

  it("clamps minutesUntil to at least 1", () => {
    const due = reminderDue({
      session: base,
      prefs: prefs(),
      now: at("2026-10-05T06:59:30Z"),
      timezone: "UTC",
      sentBefore: false,
      sentMissed: false,
    });
    expect(due).toEqual({ kind: "before", minutesUntil: 1 });
  });

  it("does not fire before the window opens", () => {
    const due = reminderDue({
      session: base,
      prefs: prefs(),
      now: at("2026-10-05T06:40:00Z"),
      timezone: "UTC",
      sentBefore: false,
      sentMissed: false,
    });
    expect(due).toBeNull();
  });

  it("does not fire before-reminder after session time", () => {
    const due = reminderDue({
      session: base,
      prefs: prefs(),
      now: at("2026-10-05T07:01:00Z"),
      timezone: "UTC",
      sentBefore: false,
      sentMissed: false,
    });
    expect(due).toBeNull();
  });

  it("respects the before-reminder dedupe flag", () => {
    const due = reminderDue({
      session: base,
      prefs: prefs(),
      now: at("2026-10-05T06:50:00Z"),
      timezone: "UTC",
      sentBefore: true,
      sentMissed: false,
    });
    expect(due).toBeNull();
  });

  it("is disabled when prefs.enabled is false", () => {
    const due = reminderDue({
      session: base,
      prefs: prefs({ enabled: false }),
      now: at("2026-10-05T06:50:00Z"),
      timezone: "UTC",
      sentBefore: false,
      sentMissed: false,
    });
    expect(due).toBeNull();
  });

  it("returns missed-reminder past the grace period", () => {
    const due = reminderDue({
      session: base,
      prefs: prefs(),
      now: at("2026-10-05T07:46:00Z"),
      timezone: "UTC",
      sentBefore: false,
      sentMissed: false,
    });
    expect(due).toEqual({ kind: "missed" });
  });

  it("does not fire missed-reminder inside the grace period", () => {
    const due = reminderDue({
      session: base,
      prefs: prefs(),
      now: at("2026-10-05T07:45:00Z"),
      timezone: "UTC",
      sentBefore: false,
      sentMissed: false,
    });
    expect(due).toBeNull();
  });

  it("respects the missed dedupe flag and maxMissedPerSession", () => {
    const common = {
      session: base,
      prefs: prefs(),
      now: at("2026-10-05T08:00:00Z"),
      timezone: "UTC",
    };
    expect(
      reminderDue({ ...common, sentBefore: false, sentMissed: true })
    ).toBeNull();
    expect(
      reminderDue({
        session: base,
        prefs: prefs({ maxMissedPerSession: 0 }),
        now: at("2026-10-05T08:00:00Z"),
        timezone: "UTC",
        sentBefore: false,
        sentMissed: false,
      })
    ).toBeNull();
  });

  it("never fires for completed sessions", () => {
    const due = reminderDue({
      session: { ...base, completed: true },
      prefs: prefs(),
      now: at("2026-10-05T06:50:00Z"),
      timezone: "UTC",
      sentBefore: false,
      sentMissed: false,
    });
    expect(due).toBeNull();
  });

  it("evaluates schedule times in the user timezone, not server UTC", () => {
    // 07:00 in New York (UTC-4 in October) = 11:00 UTC
    const due = reminderDue({
      session: base,
      prefs: prefs(),
      now: at("2026-10-05T10:50:00Z"),
      timezone: "America/New_York",
      sentBefore: false,
      sentMissed: false,
    });
    expect(due).toEqual({ kind: "before", minutesUntil: 10 });

    const dueWrongZone = reminderDue({
      session: base,
      prefs: prefs(),
      now: at("2026-10-05T10:50:00Z"),
      timezone: "UTC",
      sentBefore: false,
      sentMissed: false,
    });
    expect(dueWrongZone?.kind).toBe("missed");
  });

  it("returns null for malformed time strings", () => {
    const due = reminderDue({
      session: { ...base, scheduledTime: "25:99" },
      prefs: prefs(),
      now: at("2026-10-05T06:50:00Z"),
      timezone: "UTC",
      sentBefore: false,
      sentMissed: false,
    });
    expect(due).toBeNull();
  });
});

describe("zonedToUtc", () => {
  it("converts wall time in a zone to the UTC instant", () => {
    expect(zonedToUtc("2026-10-05", "07:00", "UTC")?.toISOString()).toBe(
      "2026-10-05T07:00:00.000Z"
    );
    expect(
      zonedToUtc("2026-10-05", "07:00", "America/New_York")?.toISOString()
    ).toBe("2026-10-05T11:00:00.000Z");
    expect(
      zonedToUtc("2026-10-05", "07:00", "Asia/Tokyo")?.toISOString()
    ).toBe("2026-10-04T22:00:00.000Z");
  });

  it("handles DST boundaries", () => {
    // US spring-forward 2026-03-08 02:00 EST -> 03:00 EDT.
    // 01:00 that day is still EST (UTC-5); 07:00 is already EDT (UTC-4).
    expect(
      zonedToUtc("2026-03-08", "01:00", "America/New_York")?.toISOString()
    ).toBe("2026-03-08T06:00:00.000Z");
    expect(
      zonedToUtc("2026-03-08", "07:00", "America/New_York")?.toISOString()
    ).toBe("2026-03-08T11:00:00.000Z");
    expect(
      zonedToUtc("2026-03-09", "07:00", "America/New_York")?.toISOString()
    ).toBe("2026-03-09T11:00:00.000Z");
  });

  it("falls back to UTC for unknown zones, null for bad input", () => {
    expect(zonedToUtc("not-a-date", "07:00", "UTC")).toBeNull();
    expect(zonedToUtc("2026-10-05", "7am", "UTC")).toBeNull();
    expect(zonedToUtc("2026-10-05", "07:00", "Not/AZone")?.toISOString()).toBe(
      "2026-10-05T07:00:00.000Z"
    );
  });
});

describe("localDateKey / previousDateKey", () => {
  it("gives the calendar date for the zone", () => {
    expect(localDateKey(at("2026-10-05T23:30:00Z"), "UTC")).toBe(
      "2026-10-05"
    );
    expect(localDateKey(at("2026-10-05T23:30:00Z"), "Pacific/Auckland")).toBe(
      "2026-10-06"
    );
    expect(localDateKey(at("2026-10-05T02:00:00Z"), "Pacific/Auckland")).toBe(
      "2026-10-05"
    );
  });

  it("walks back across month boundaries", () => {
    expect(previousDateKey("2026-10-01")).toBe("2026-09-30");
    expect(previousDateKey("2026-03-01")).toBe("2026-02-28");
    expect(previousDateKey("2027-01-01")).toBe("2026-12-31");
  });
});

describe("formatChapters / sessionLabel", () => {
  it("formats ranges and lists", () => {
    expect(
      formatChapters([
        { bookName: "Genesis", start: 1, end: 1 },
        { bookName: "Matthew", start: 5, end: 7 },
      ])
    ).toBe("Genesis 1, Matthew 5-7");
    expect(formatChapters([])).toBe("your reading");
    expect(formatChapters("bad")).toBe("your reading");
    expect(
      formatChapters([{ bookId: "gen", start: 2, end: 2 }])
    ).toBe("gen 2");
  });

  it("labels session numbers", () => {
    expect(sessionLabel(1)).toBe("morning");
    expect(sessionLabel(2)).toBe("afternoon");
    expect(sessionLabel(3)).toBe("evening");
    expect(sessionLabel(4)).toBe("evening");
  });
});
