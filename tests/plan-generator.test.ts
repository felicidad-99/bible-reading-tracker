import { describe, it, expect } from "vitest";
import {
  generateReadingPlan,
  distributeEvenly,
  calculateStreaks,
  computeDayStatus,
  computeSessionStatus,
  regenerateRemainingPlan,
  chaptersToRanges,
  formatChapterRange,
} from "@/lib/plan/generator";
import { TOTAL_CHAPTERS, getFlatChapters, TOTAL_OT_CHAPTERS, TOTAL_NT_CHAPTERS } from "@/lib/plan/bible-books";

function collectChapterKeys(days: ReturnType<typeof generateReadingPlan>["days"]) {
  const keys: string[] = [];
  for (const day of days) {
    for (const session of day.sessions) {
      for (const range of session.chapters) {
        for (let ch = range.start; ch <= range.end; ch++) {
          keys.push(`${range.bookId}:${ch}`);
        }
      }
    }
  }
  return keys;
}

function assertComplete(days: ReturnType<typeof generateReadingPlan>["days"]) {
  const keys = collectChapterKeys(days);
  expect(keys.length).toBe(TOTAL_CHAPTERS);
  expect(new Set(keys).size).toBe(TOTAL_CHAPTERS);

  const flat = getFlatChapters();
  const expected = new Set(flat.map((c) => `${c.bookId}:${c.chapter}`));
  const actual = new Set(keys);
  expect(actual).toEqual(expected);
}

describe("bible-books seed", () => {
  it("has 66 books and 1189 chapters", () => {
    expect(TOTAL_OT_CHAPTERS).toBe(929);
    expect(TOTAL_NT_CHAPTERS).toBe(260);
    expect(TOTAL_CHAPTERS).toBe(1189);
  });
});

describe("distributeEvenly", () => {
  it("splits with remainder on early buckets", () => {
    expect(distributeEvenly(1189, 30)).toEqual([
      ...Array(19).fill(40),
      ...Array(11).fill(39),
    ]);
    expect(distributeEvenly(1189, 30).reduce((a, b) => a + b, 0)).toBe(1189);
  });

  it("handles zero and edge cases", () => {
    expect(distributeEvenly(0, 5)).toEqual([0, 0, 0, 0, 0]);
    expect(distributeEvenly(3, 1)).toEqual([3]);
    expect(distributeEvenly(5, 0)).toEqual([]);
  });
});

describe("generateReadingPlan", () => {
  it("7-day plan: 7 days, 1189 chapters, no dupes, no gaps", () => {
    const plan = generateReadingPlan({
      startDate: "2026-09-23",
      durationDays: 7,
      frequency: 1,
    });
    expect(plan.days.length).toBe(7);
    expect(plan.totalChapters).toBe(1189);
    assertComplete(plan.days);
    expect(plan.endDate).toBe("2026-09-29");
  });

  it("30-day plan: 30 days, 1189 chapters, no dupes, no gaps", () => {
    const plan = generateReadingPlan({
      startDate: "2026-09-23",
      durationDays: 30,
      frequency: 2,
    });
    expect(plan.days.length).toBe(30);
    expect(plan.totalChapters).toBe(1189);
    assertComplete(plan.days);
    expect(plan.endDate).toBe("2026-10-22");
    expect(plan.chaptersPerDayBase).toBe(39);
    expect(plan.chaptersPerDayRemainder).toBe(19);
  });

  it("365-day plan: 365 days, 1189 chapters, no dupes, no gaps", () => {
    const plan = generateReadingPlan({
      startDate: "2026-01-01",
      durationDays: 365,
      frequency: 1,
    });
    expect(plan.days.length).toBe(365);
    expect(plan.totalChapters).toBe(1189);
    assertComplete(plan.days);
    expect(plan.endDate).toBe("2026-12-31");
  });

  it("1-day plan puts all chapters on one day", () => {
    const plan = generateReadingPlan({
      startDate: "2026-09-23",
      durationDays: 1,
      frequency: 3,
    });
    expect(plan.days.length).toBe(1);
    expect(plan.days[0].totalChapters).toBe(1189);
    assertComplete(plan.days);
    expect(plan.days[0].sessions.length).toBe(3);
    const sum = plan.days[0].sessions.reduce((a, s) => a + s.chapterCount, 0);
    expect(sum).toBe(1189);
  });

  it("frequency once/twice/thrice creates correct session counts", () => {
    for (const freq of [1, 2, 3] as const) {
      const plan = generateReadingPlan({
        startDate: "2026-09-23",
        durationDays: 14,
        frequency: freq,
      });
      for (const day of plan.days) {
        expect(day.sessions.length).toBe(freq);
        const sum = day.sessions.reduce((a, s) => a + s.chapterCount, 0);
        expect(sum).toBe(day.totalChapters);
      }
      assertComplete(plan.days);
    }
  });

  it("never splits a chapter across sessions", () => {
    const plan = generateReadingPlan({
      startDate: "2026-09-23",
      durationDays: 10,
      frequency: 3,
    });
    for (const day of plan.days) {
      for (const session of day.sessions) {
        for (const range of session.chapters) {
          expect(range.start).toBeGreaterThanOrEqual(1);
          expect(range.end).toBeGreaterThanOrEqual(range.start);
          expect(Number.isInteger(range.start)).toBe(true);
          expect(Number.isInteger(range.end)).toBe(true);
        }
      }
    }
  });

  it("final day is not overloaded (max - min <= 1)", () => {
    const plan = generateReadingPlan({
      startDate: "2026-09-23",
      durationDays: 30,
      frequency: 1,
    });
    const counts = plan.days.map((d) => d.totalChapters);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    expect(plan.days[plan.days.length - 1].totalChapters).toBeLessThanOrEqual(
      Math.ceil(1189 / 30)
    );
  });

  it("handles start date at month end", () => {
    const plan = generateReadingPlan({
      startDate: "2026-01-31",
      durationDays: 3,
      frequency: 1,
    });
    expect(plan.days[0].date).toBe("2026-01-31");
    expect(plan.days[1].date).toBe("2026-02-01");
    expect(plan.days[2].date).toBe("2026-02-02");
  });

  it("handles leap year start on Feb 29", () => {
    const plan = generateReadingPlan({
      startDate: "2028-02-29",
      durationDays: 2,
      frequency: 1,
    });
    expect(plan.days[0].date).toBe("2028-02-29");
    expect(plan.days[1].date).toBe("2028-03-01");
  });

  it("rejects invalid input", () => {
    expect(() =>
      generateReadingPlan({ startDate: "not-a-date", durationDays: 10, frequency: 1 })
    ).toThrow(/Invalid start date/);
    expect(() =>
      generateReadingPlan({ startDate: "2026-01-01", durationDays: 0, frequency: 1 })
    ).toThrow(/Duration/);
    expect(() =>
      generateReadingPlan({ startDate: "2026-01-01", durationDays: 10, frequency: 5 as never })
    ).toThrow(/Frequency/);
  });
});

describe("chaptersToRanges", () => {
  it("merges consecutive chapters in same book", () => {
    const flat = getFlatChapters().slice(0, 13);
    const ranges = chaptersToRanges(flat);
    expect(ranges).toEqual([
      { bookId: "GEN", bookName: "Genesis", start: 1, end: 13 },
    ]);
    expect(formatChapterRange(ranges[0])).toBe("Genesis 1-13");
  });

  it("splits ranges at book boundaries", () => {
    const flat = getFlatChapters().slice(45, 55);
    const ranges = chaptersToRanges(flat);
    expect(ranges[0]).toEqual({
      bookId: "GEN",
      bookName: "Genesis",
      start: 46,
      end: 50,
    });
    expect(ranges[1]).toEqual({
      bookId: "EXO",
      bookName: "Exodus",
      start: 1,
      end: 5,
    });
  });
});

describe("calculateStreaks", () => {
  it("computes current and longest streak", () => {
    const dates = [
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-05",
      "2026-09-06",
      "2026-09-07",
      "2026-09-08",
    ];
    const result = calculateStreaks(dates, "2026-09-08");
    expect(result.currentStreak).toBe(4);
    expect(result.longestStreak).toBe(4);
  });

  it("breaks current streak if today not completed but yesterday was", () => {
    const dates = ["2026-09-06", "2026-09-07", "2026-09-08"];
    const result = calculateStreaks(dates, "2026-09-10");
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(3);
  });

  it("zero when no completions", () => {
    expect(calculateStreaks([], "2026-09-10")).toEqual({
      currentStreak: 0,
      longestStreak: 0,
    });
  });
});

describe("status computation", () => {
  it("marks completed", () => {
    expect(
      computeSessionStatus("2026-09-23", "07:00", true, new Date("2026-09-23T12:00:00"))
    ).toBe("completed");
  });

  it("marks missed after grace period", () => {
    expect(
      computeSessionStatus("2026-09-23", "07:00", false, new Date("2026-09-23T09:00:00"))
    ).toBe("missed");
  });

  it("marks not_started before scheduled time", () => {
    expect(
      computeSessionStatus("2026-09-23", "20:00", false, new Date("2026-09-23T12:00:00"))
    ).toBe("not_started");
  });

  it("day status missed when past incomplete", () => {
    const status = computeDayStatus(
      {
        date: "2026-09-20",
        sessions: [
          { scheduledTime: "07:00", completed: false },
          { scheduledTime: "20:00", completed: false },
        ],
      },
      new Date("2026-09-23T12:00:00")
    );
    expect(status).toBe("missed");
  });

  it("day status completed when all sessions done", () => {
    const status = computeDayStatus(
      {
        date: "2026-09-20",
        sessions: [
          { scheduledTime: "07:00", completed: true },
          { scheduledTime: "20:00", completed: true },
        ],
      },
      new Date("2026-09-23T12:00:00")
    );
    expect(status).toBe("completed");
  });
});

describe("regenerateRemainingPlan", () => {
  it("preserves completed days", () => {
    const original = generateReadingPlan({
      startDate: "2026-09-01",
      durationDays: 10,
      frequency: 1,
    });

    const existing = original.days.map((d, i) => ({
      ...d,
      status: i < 3 ? "completed" : "not_started",
    }));

    const regenerated = regenerateRemainingPlan(existing, {
      startDate: "2026-09-01",
      durationDays: 15,
      frequency: 2,
    });

    expect(regenerated.length).toBe(15);
    expect(regenerated[0].totalChapters).toBe(existing[0].totalChapters);
    expect(regenerated[1].sessions[0].chapters).toEqual(
      existing[1].sessions[0].chapters
    );
    expect(regenerated[3].sessions.length).toBe(2);
  });
});
