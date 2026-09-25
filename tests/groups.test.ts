import { describe, it, expect } from "vitest";
import {
  evaluateJoin,
  groupPlanInput,
  nextOwnerAfterLeave,
  groupHasEnded,
  MAX_GROUP_MEMBERS,
} from "@/lib/groups";

describe("evaluateJoin", () => {
  it("allows joining when below cap", () => {
    expect(evaluateJoin(0, false)).toBe("ok");
    expect(evaluateJoin(MAX_GROUP_MEMBERS - 1, false)).toBe("ok");
  });

  it("blocks joining a full group", () => {
    expect(evaluateJoin(MAX_GROUP_MEMBERS, false)).toBe("full");
    expect(evaluateJoin(MAX_GROUP_MEMBERS + 1, false)).toBe("full");
  });

  it("rejects duplicate membership even when below cap", () => {
    expect(evaluateJoin(1, true)).toBe("already_member");
    expect(evaluateJoin(MAX_GROUP_MEMBERS, true)).toBe("already_member");
  });
});

describe("groupPlanInput", () => {
  it("converts Json scheduledTimes into sessionTimes string array", () => {
    const input = groupPlanInput({
      startDate: "2026-01-01",
      durationDays: 90,
      frequency: 2,
      scheduledTimes: ["06:30", "20:00"],
      translation: "BSB",
    });
    expect(input).toEqual({
      startDate: "2026-01-01",
      durationDays: 90,
      frequency: 2,
      translation: "BSB",
      sessionTimes: ["06:30", "20:00"],
    });
  });

  it("drops non-string junk from Json value", () => {
    const input = groupPlanInput({
      startDate: "2026-01-01",
      durationDays: 30,
      frequency: 1,
      scheduledTimes: ["07:00", 42, null, { t: 1 }],
      translation: "KJV",
    });
    expect(input.sessionTimes).toEqual(["07:00"]);
  });
});

describe("nextOwnerAfterLeave", () => {
  const members = [
    { userId: "owner", joinedAt: new Date("2026-01-01T00:00:00Z") },
    { userId: "second", joinedAt: new Date("2026-01-02T00:00:00Z") },
    { userId: "third", joinedAt: new Date("2026-01-03T00:00:00Z") },
  ];

  it("promotes earliest remaining member when owner leaves", () => {
    expect(nextOwnerAfterLeave(members, "owner")).toBe("second");
  });

  it("returns null when last member leaves", () => {
    expect(nextOwnerAfterLeave([members[0]], "owner")).toBeNull();
  });

  it("does not promote the leaver", () => {
    expect(nextOwnerAfterLeave(members, "second")).toBe("owner");
  });
});

describe("groupHasEnded", () => {
  const group = { startDate: "2026-01-01", durationDays: 10 }; // ends 2026-01-10

  it("false on first day", () => {
    expect(groupHasEnded(group, new Date("2026-01-01T12:00:00Z"))).toBe(false);
  });

  it("false on last day", () => {
    expect(groupHasEnded(group, new Date("2026-01-10T12:00:00Z"))).toBe(false);
  });

  it("true after last day", () => {
    expect(groupHasEnded(group, new Date("2026-01-11T00:00:00Z"))).toBe(true);
  });
});
