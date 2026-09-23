import { describe, it, expect, beforeAll } from "vitest";
import { config } from "dotenv";
import {
  YouVersionProvider,
  BibleService,
  BibleReferenceError,
  clearBibleCacheForTests,
} from "@/lib/bible/bibleService";
import { resolveTranslation } from "@/lib/bible/translation-map";

config({ path: ".env" });
config({ path: ".env.local" });

const key = process.env.YVP_APP_KEY;
const live = Boolean(key && key.length >= 20);

describe.skipIf(!live)("YouVersion live licensing smoke", () => {
  let yv: YouVersionProvider;
  let service: BibleService;
  let translations: Awaited<ReturnType<YouVersionProvider["getTranslations"]>>;

  beforeAll(async () => {
    yv = new YouVersionProvider(key as string);
    service = new BibleService(yv);
    translations = await yv.getTranslations();
  }, 60000);

  it("lists licensed English translations", () => {
    expect(translations.length).toBeGreaterThan(0);
    const ids = translations.map((t) => t.id);
    expect(ids).toContain("BSB");
    expect(ids.some((id) => /NIV/i.test(id))).toBe(true);
    expect(ids.some((id) => /AMP|NASB/i.test(id))).toBe(true);
  });

  it("merged service list includes Free Use KJV plus licensed versions", async () => {
    clearBibleCacheForTests();
    const merged = new BibleService(yv);
    const list = await merged.getTranslations();
    const ids = list.map((t) => t.id);

    expect(ids).toContain("KJV");
    expect(ids).toContain("BSB");
    expect(ids.some((id) => /NIV/i.test(id))).toBe(true);
    expect(list.length).toBeGreaterThan(translations.length);
  }, 60000);

  it("resolves app-facing IDs to YouVersion ids", async () => {
    expect((await resolveTranslation("BSB"))?.yvId).toBe(3034);
    expect((await resolveTranslation("NIV"))?.yvId).toBe(111);
    expect((await resolveTranslation("NIV11"))?.yvId).toBe(111);
    expect((await resolveTranslation("engWEBUS"))?.yvId).toBe(206);
    expect((await resolveTranslation("AMP"))?.yvId).toBe(1588);
  });

  it("serves BSB John 3 from YouVersion with verses + copyright", async () => {
    clearBibleCacheForTests();
    const ch = await service.getChapter("BSB", "JHN", 3);
    expect(ch.source).toBe("youversion");
    expect(ch.bookName).toBe("John");
    expect(ch.verses.length).toBeGreaterThan(20);
    const v16 = ch.verses.find((v) => v.number === 16);
    expect(v16?.text.toLowerCase()).toContain("god so loved");
    expect(ch.copyright).toBeTruthy();
  }, 60000);

  it("serves licensed NIV11 John 3 from YouVersion", async () => {
    clearBibleCacheForTests();
    const ch = await service.getChapter("NIV11", "JHN", 3);
    expect(ch.source).toBe("youversion");
    expect(ch.verses.length).toBeGreaterThan(20);
    expect(ch.translationId).toBe("NIV11");
  }, 60000);

  it("serves AMP John 3 from YouVersion", async () => {
    clearBibleCacheForTests();
    const ch = await service.getChapter("AMP", "JHN", 3);
    expect(ch.source).toBe("youversion");
    expect(ch.verses.length).toBeGreaterThan(10);
  }, 60000);

  it("falls back to Free Use when YouVersion lacks the version (KJV)", async () => {
    clearBibleCacheForTests();
    const ch = await service.getChapter("KJV", "JHN", 3);
    expect(ch.verses.length).toBeGreaterThan(0);
    expect(ch.source).toBe("helloao");
    expect(ch.translationId).toBe("KJV");
  }, 60000);

  it("maps eng_kjv through fallback without reference error", async () => {
    clearBibleCacheForTests();
    const ch = await service.getChapter("eng_kjv", "GEN", 1);
    expect(ch.verses.length).toBeGreaterThan(0);
  }, 60000);

  it("throws reference error for invalid chapter on licensed version", async () => {
    clearBibleCacheForTests();
    await expect(yv.getChapter("BSB", "JHN", 999)).rejects.toBeInstanceOf(
      BibleReferenceError
    );
  }, 60000);

  it("still serves Free Use alone", async () => {
    clearBibleCacheForTests();
    const only = new BibleService(null);
    const ch = await only.getChapter("BSB", "JHN", 1);
    expect(ch.verses.length).toBeGreaterThan(0);
  }, 60000);
});

describe.skipIf(live)("YouVersion live licensing smoke (skipped)", () => {
  it("needs YVP_APP_KEY", () => {
    expect(live).toBe(false);
  });
});
