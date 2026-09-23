import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  BibleService,
  clearBibleCacheForTests,
  BibleReferenceError,
  UnmappedTranslationError,
} from "@/lib/bible/bibleService";
import type {
  BibleServiceProvider,
  ChapterResult,
  TranslationInfo,
} from "@/lib/bible/bibleService";
import { YouVersionProvider } from "@/lib/bible/youversionProvider";
import {
  resolveTranslation,
  resetTranslationMapForTests,
} from "@/lib/bible/translation-map";

function chapterResult(
  source: "youversion" | "helloao",
  overrides: Partial<ChapterResult> = {}
): ChapterResult {
  return {
    bookId: "JHN",
    bookName: "John",
    chapter: 3,
    translationId: "BSB",
    translationName: source === "youversion" ? "Berean Standard Bible" : "BSB",
    verses: [{ number: 16, text: "For God so loved the world…" }],
    source,
    ...overrides,
  };
}

function translationList(id: string): TranslationInfo[] {
  return [
    {
      id,
      name: id,
      englishName: id,
      language: "eng",
      shortName: id,
      textDirection: "ltr",
      numberOfBooks: 66,
      totalNumberOfChapters: 1189,
    },
  ];
}

class MockProvider implements BibleServiceProvider {
  calls = { translations: 0, chapter: 0 };
  private chapterImpl: BibleServiceProvider["getChapter"];
  private translationsImpl: BibleServiceProvider["getTranslations"];

  constructor(
    chapterImpl: BibleServiceProvider["getChapter"],
    translationsImpl: BibleServiceProvider["getTranslations"] = async () =>
      translationList("mock")
  ) {
    this.chapterImpl = chapterImpl;
    this.translationsImpl = translationsImpl;
  }

  getTranslations(): Promise<TranslationInfo[]> {
    this.calls.translations += 1;
    return this.translationsImpl();
  }

  getChapter(
    translationId: string,
    bookId: string,
    chapter: number
  ): Promise<ChapterResult> {
    this.calls.chapter += 1;
    return this.chapterImpl(translationId, bookId, chapter);
  }
}

describe("BibleService fallback", () => {
  beforeEach(() => {
    clearBibleCacheForTests();
    resetTranslationMapForTests();
  });

  afterEach(() => {
    clearBibleCacheForTests();
    resetTranslationMapForTests();
  });

  it("uses primary when it succeeds and does not call fallback", async () => {
    const primary = new MockProvider(async () => chapterResult("youversion"));
    const fallback = new MockProvider(async () => chapterResult("helloao"));
    const service = new BibleService(primary, fallback);

    const result = await service.getChapter("BSB", "JHN", 3);

    expect(result.source).toBe("youversion");
    expect(primary.calls.chapter).toBe(1);
    expect(fallback.calls.chapter).toBe(0);
  });

  it("falls back to Free Use API on primary 5xx/network error", async () => {
    const primary = new MockProvider(async () => {
      throw new Error("YouVersion returned 500");
    });
    const fallback = new MockProvider(async () => chapterResult("helloao"));
    const service = new BibleService(primary, fallback);

    const result = await service.getChapter("BSB", "JHN", 3);

    expect(result.source).toBe("helloao");
    expect(primary.calls.chapter).toBe(1);
    expect(fallback.calls.chapter).toBe(1);
  });

  it("falls back when translation is unmapped for primary", async () => {
    const primary = new MockProvider(async () => {
      throw new UnmappedTranslationError("eng_kjv");
    });
    const fallback = new MockProvider(async () =>
      chapterResult("helloao", { translationId: "eng_kjv" })
    );
    const service = new BibleService(primary, fallback);

    const result = await service.getChapter("eng_kjv", "JHN", 3);

    expect(result.source).toBe("helloao");
    expect(result.translationId).toBe("eng_kjv");
    expect(fallback.calls.chapter).toBe(1);
  });

  it("keeps the requested translation id on Free Use fallback", async () => {
    const primary = new MockProvider(async () => {
      throw new UnmappedTranslationError("KJV");
    });
    const fallback = new MockProvider(async () =>
      chapterResult("helloao", { translationId: "eng_kjv" })
    );
    const service = new BibleService(primary, fallback);

    const result = await service.getChapter("KJV", "JHN", 3);

    expect(result.source).toBe("helloao");
    expect(result.translationId).toBe("KJV");
  });

  it("does not fall back on BibleReferenceError from primary", async () => {
    const primary = new MockProvider(async () => {
      throw new BibleReferenceError("JHN 999 is not a valid reference");
    });
    const fallback = new MockProvider(async () => chapterResult("helloao"));
    const service = new BibleService(primary, fallback);

    await expect(service.getChapter("BSB", "JHN", 999)).rejects.toBeInstanceOf(
      BibleReferenceError
    );
    expect(fallback.calls.chapter).toBe(0);
  });

  it("uses only Free Use API when primary is null (no key)", async () => {
    const fallback = new MockProvider(async () => chapterResult("helloao"));
    const service = new BibleService(null, fallback);

    const result = await service.getChapter("BSB", "JHN", 3);

    expect(result.source).toBe("helloao");
    expect(fallback.calls.chapter).toBe(1);
    expect(fallback.calls.translations).toBe(0);
  });

  it("merges primary and fallback translations", async () => {
    const primary = new MockProvider(
      async () => chapterResult("youversion"),
      async () => translationList("NIV")
    );
    const fallback = new MockProvider(
      async () => chapterResult("helloao"),
      async () => [...translationList("KJV"), ...translationList("BSB")]
    );
    const service = new BibleService(primary, fallback);

    const list = await service.getTranslations();
    const ids = list.map((t) => t.id);

    expect(primary.calls.translations).toBe(1);
    expect(fallback.calls.translations).toBe(1);
    expect(ids).toContain("NIV");
    expect(ids).toContain("KJV");
    expect(ids).toContain("BSB");
  });

  it("prefers primary entry when both lists have the same version", async () => {
    const primary = new MockProvider(
      async () => chapterResult("youversion"),
      async () => [
        {
          ...translationList("BSB")[0],
          name: "Berean Standard Bible (YV)",
          englishName: "Berean Standard Bible (YV)",
        },
      ]
    );
    const fallback = new MockProvider(
      async () => chapterResult("helloao"),
      async () => [
        {
          ...translationList("BSB")[0],
          name: "BSB Free",
          englishName: "BSB Free",
        },
      ]
    );
    const service = new BibleService(primary, fallback);

    const list = await service.getTranslations();
    const bsb = list.find((t) => t.id === "BSB");

    expect(bsb?.englishName).toBe("Berean Standard Bible (YV)");
  });

  it("normalizes Free Use ids to friendly display ids", async () => {
    const fallback = new MockProvider(
      async () => chapterResult("helloao"),
      async () => [
        {
          ...translationList("eng_kjv")[0],
          name: "King James Version",
          englishName: "King James Version",
        },
        {
          ...translationList("eng_dby")[0],
          name: "Darby Translation",
          englishName: "Darby Translation",
        },
      ]
    );
    const service = new BibleService(null, fallback);

    const list = await service.getTranslations();
    const ids = list.map((t) => t.id);

    expect(ids).toContain("KJV");
    expect(ids).toContain("DARBY");
    expect(ids).not.toContain("eng_kjv");
  });

  it("falls back to Free Use translations when primary list fails", async () => {
    const primary = new MockProvider(
      async () => chapterResult("youversion"),
      async () => {
        throw new Error("YouVersion translations returned 500");
      }
    );
    const fallback = new MockProvider(
      async () => chapterResult("helloao"),
      async () => translationList("BSB")
    );
    const service = new BibleService(primary, fallback);

    const list = await service.getTranslations();

    expect(list[0]?.id).toBe("BSB");
    expect(fallback.calls.translations).toBe(1);
  });

  it("caches chapter results after first successful fetch", async () => {
    const primary = new MockProvider(async () => chapterResult("youversion"));
    const fallback = new MockProvider(async () => chapterResult("helloao"));
    const service = new BibleService(primary, fallback);

    await service.getChapter("CACHE", "JHN", 3);
    await service.getChapter("CACHE", "JHN", 3);

    expect(primary.calls.chapter).toBe(1);
  });
});

describe("translation-map resolve", () => {
  beforeEach(() => {
    resetTranslationMapForTests();
  });

  afterEach(() => {
    resetTranslationMapForTests();
  });

  it("resolves BSB to YouVersion id 3034", async () => {
    const resolved = await resolveTranslation("BSB");
    expect(resolved?.yvId).toBe(3034);
  });

  it("resolves KJV and eng_kjv aliases", async () => {
    expect((await resolveTranslation("KJV"))?.yvId).toBe(1);
    expect((await resolveTranslation("eng_kjv"))?.yvId).toBe(1);
  });

  it("resolves WEB aliases to 206", async () => {
    expect((await resolveTranslation("WEB"))?.yvId).toBe(206);
    expect((await resolveTranslation("ENGWEBP"))?.yvId).toBe(206);
  });

  it("returns null for unknown translation ids without a key", async () => {
    const prev = process.env.YVP_APP_KEY;
    delete process.env.YVP_APP_KEY;
    try {
      expect(await resolveTranslation("NOPE999")).toBeNull();
    } finally {
      if (prev !== undefined) process.env.YVP_APP_KEY = prev;
    }
  });
});

describe("YouVersionProvider parsing", () => {
  beforeEach(() => {
    resetTranslationMapForTests();
  });

  afterEach(() => {
    resetTranslationMapForTests();
    delete process.env.YVP_APP_KEY;
  });

  it("parses HTML passage into ChapterResult", async () => {
    process.env.YVP_APP_KEY = "test-key";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/books/JHN/chapters/3/verses")) {
        return new Response(
          JSON.stringify({
            data: [
              { id: "15", passage_id: "JHN.3.15", title: "15" },
              { id: "16", passage_id: "JHN.3.16", title: "16" },
            ],
          }),
          { status: 200 }
        );
      }
      if (url.includes("/passages/JHN.3?")) {
        const html =
          '<div><span class="yv-v" v="15"></span><span class="yv-vlbl">15</span>That whosoever believeth… ' +
          '<span class="yv-v" v="16"></span><span class="yv-vlbl">16</span>For God so loved the world…</div>';
        return new Response(JSON.stringify({ id: "JHN.3", content: html, reference: "John 3" }), {
          status: 200,
        });
      }
      if (url.includes("/v1/bibles/3034")) {
        return new Response(
          JSON.stringify({
            id: 3034,
            abbreviation: "BSB",
            title: "Berean Standard Bible",
            copyright: "Public Domain",
          }),
          { status: 200 }
        );
      }
      return new Response("not found", { status: 404 });
    });

    const provider = new YouVersionProvider("test-key", fetchMock as typeof fetch);
    const result = await provider.getChapter("BSB", "JHN", 3);

    expect(result.source).toBe("youversion");
    expect(result.translationId).toBe("BSB");
    expect(result.bookName).toBe("John");
    expect(result.copyright).toBe("Public Domain");
    expect(result.verses).toEqual([
      { number: 15, text: "That whosoever believeth…" },
      { number: 16, text: "For God so loved the world…" },
    ]);
  });

  it("throws BibleReferenceError on 404 verses when bible exists", async () => {
    process.env.YVP_APP_KEY = "test-key";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/v1/bibles/3034") && !url.includes("/books/") && !url.includes("/passages/")) {
        return new Response(
          JSON.stringify({
            id: 3034,
            abbreviation: "BSB",
            title: "Berean Standard Bible",
            copyright: "Public Domain",
          }),
          { status: 200 }
        );
      }
      return new Response("missing", { status: 404 });
    });
    const provider = new YouVersionProvider("test-key", fetchMock as typeof fetch);

    await expect(provider.getChapter("BSB", "JHN", 999)).rejects.toBeInstanceOf(
      BibleReferenceError
    );
  });

  it("throws UnmappedTranslationError when bible id itself is 404", async () => {
    process.env.YVP_APP_KEY = "test-key";
    resetTranslationMapForTests();
    const fetchMock = vi.fn(
      async () => new Response("missing", { status: 404 })
    );
    const provider = new YouVersionProvider("test-key", fetchMock as typeof fetch);

    await expect(provider.getChapter("BSB", "JHN", 3)).rejects.toBeInstanceOf(
      UnmappedTranslationError
    );
  });

  it("throws UnmappedTranslationError for unknown ids", async () => {
    process.env.YVP_APP_KEY = "test-key";
    const fetchMock = vi.fn(
      async () => new Response("{}", { status: 200 })
    );
    const provider = new YouVersionProvider("test-key", fetchMock as typeof fetch);

    await expect(
      provider.getChapter("ZZZZ_UNKNOWN", "JHN", 3)
    ).rejects.toBeInstanceOf(UnmappedTranslationError);
  });
});
