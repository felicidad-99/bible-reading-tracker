import {
  BIBLE_BOOKS,
  getFlatChapters,
  type FlatChapter,
} from "./bible-books";
import type { Frequency } from "./generator";

export interface PlanPreset {
  id: string;
  name: string;
  description: string;
  durationDays: number;
  frequency: Frequency;
  /** Short display meta, e.g. "90 days · Avg. 15 mins/day" */
  meta: string;
  /** Book ids to include; omit for the whole Bible (canonical order). */
  bookIds?: string[];
  /** Material Symbols glyph shown in cards/lists. */
  icon: string;
  /** Accent tone used for the icon/link in library rows. */
  tone: "ember" | "verdant" | "tertiary" | "gold";
  /** Short letter badge shown on the /plans library cards. */
  badge: string;
  /** Scope chip, e.g. "NT only". */
  scope: string;
}

export const PLAN_PRESETS: PlanPreset[] = [
  {
    id: "bible-year",
    name: "Bible in a Year",
    description: "Canonical journey through Genesis to Revelation",
    durationDays: 365,
    frequency: 1,
    meta: "365 days · Avg. 10 mins/day",
    icon: "auto_stories",
    tone: "ember",
    badge: "BY",
    scope: "Whole Bible",
  },
  {
    id: "nt-90",
    name: "New Testament in 90 Days",
    description: "A focused 3-month walk through Gospels and Epistles",
    durationDays: 90,
    frequency: 1,
    meta: "90 days · Avg. 15 mins/day",
    bookIds: BIBLE_BOOKS.filter((b) => b.testament === "NT").map((b) => b.id),
    icon: "explore",
    tone: "verdant",
    badge: "NT",
    scope: "NT only",
  },
  {
    id: "psalms-proverbs",
    name: "Psalms & Proverbs",
    description: "Daily poetic devotion, praise, and practical wisdom",
    durationDays: 60,
    frequency: 1,
    meta: "60 days · Avg. 10 mins/day",
    bookIds: ["PSA", "PRO"],
    icon: "format_quote",
    tone: "tertiary",
    badge: "P",
    scope: "Poetry & Wisdom",
  },
  {
    id: "gospels-40",
    name: "Gospels in 40 Days",
    description: "Follow the life, ministry, and teachings of Jesus",
    durationDays: 40,
    frequency: 1,
    meta: "40 days · Avg. 12 mins/day",
    bookIds: ["MAT", "MRK", "LUK", "JHN"],
    icon: "favorite",
    tone: "gold",
    badge: "G",
    scope: "4 Gospels",
  },
];

export function getPresetById(id: string): PlanPreset | undefined {
  return PLAN_PRESETS.find((p) => p.id === id);
}

/** Resolve the chapter list for a preset (canonical order, contiguous index). */
export function chaptersForPreset(preset: PlanPreset): FlatChapter[] {
  const flat = getFlatChapters();
  const selected = preset.bookIds
    ? flat.filter((c) => preset.bookIds!.includes(c.bookId))
    : flat;
  return selected.map((c, i) => ({ ...c, index: i }));
}

/**
 * Best-effort display name for plans created before names were persisted.
 * Matches on duration + frequency; falls back to a neutral label.
 */
export function derivePlanName(
  durationDays: number,
  frequency: number
): string {
  const match = PLAN_PRESETS.find(
    (p) => p.durationDays === durationDays && p.frequency === frequency
  );
  return match?.name ?? "Your reading plan";
}
