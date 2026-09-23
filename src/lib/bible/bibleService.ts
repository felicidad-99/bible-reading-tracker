export interface ChapterVerse {
  number: number;
  text: string;
}

export interface ChapterResult {
  bookId: string;
  bookName: string;
  chapter: number;
  translationId: string;
  translationName: string;
  verses: ChapterVerse[];
}

export interface TranslationInfo {
  id: string;
  name: string;
  englishName: string;
  language: string;
  languageEnglishName?: string;
  shortName: string;
  textDirection: "ltr" | "rtl";
  numberOfBooks: number;
  totalNumberOfChapters: number;
}

export interface BibleServiceProvider {
  getTranslations(): Promise<TranslationInfo[]>;
  getChapter(
    translationId: string,
    bookId: string,
    chapter: number
  ): Promise<ChapterResult>;
}

const BIBLE_API_URL = process.env.BIBLE_API_URL || "https://bible.helloao.org";

const FREE_TRANSLATIONS = new Set([
  "BSB",
  "KJV",
  "WEB",
  "ASV",
  "WEBB",
  "OEBUS",
  "OEB-CW",
  "BBE",
  "DARBY",
  "YLT",
  "engwebp",
  "clementine",
]);

export class HelloAoProvider implements BibleServiceProvider {
  private baseUrl: string;

  constructor(baseUrl: string = BIBLE_API_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async getTranslations(): Promise<TranslationInfo[]> {
    const res = await fetch(
      `${this.baseUrl}/api/available_translations.json`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) throw new Error("Failed to load translations");
    const data = (await res.json()) as { translations: TranslationInfo[] };

    return data.translations.filter((t) => {
      if (t.totalNumberOfChapters !== 1189) return false;
      if (FREE_TRANSLATIONS.has(t.id)) return true;
      const license = (t as { licenseUrl?: string }).licenseUrl ?? "";
      if (/public[-_ ]?domain|creativecommons\.org\/publicdomain|cc0/i.test(license)) {
        return true;
      }
      return false;
    });
  }

  async getChapter(
    translationId: string,
    bookId: string,
    chapter: number
  ): Promise<ChapterResult> {
    const res = await fetch(
      `${this.baseUrl}/api/${encodeURIComponent(translationId)}/${encodeURIComponent(
        bookId
      )}/${chapter}.simple.json`,
      { next: { revalidate: 86400 } }
    );

    if (res.status === 404) {
      throw new BibleReferenceError(
        `${bookId} ${chapter} is not a valid reference`
      );
    }
    if (!res.ok) {
      throw new Error(`Bible API returned ${res.status}`);
    }

    const data = await res.json();
    const verses: ChapterVerse[] = [];
    const content = data?.chapter?.content ?? [];
    for (const item of content) {
      if (item?.type === "verse") {
        verses.push({
          number: item.number,
          text: String(item.text ?? "").trim(),
        });
      }
    }

    return {
      bookId,
      bookName: data?.book?.name ?? bookId,
      chapter,
      translationId: data?.translation?.id ?? translationId,
      translationName:
        data?.translation?.englishName ??
        data?.translation?.name ??
        translationId,
      verses,
    };
  }
}

export class BibleReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BibleReferenceError";
  }
}

const memoryCache = new Map<
  string,
  { value: ChapterResult; expires: number }
>();
const CACHE_TTL = 1000 * 60 * 60 * 24;

export class BibleService {
  private provider: BibleServiceProvider;

  constructor(provider: BibleServiceProvider = new HelloAoProvider()) {
    this.provider = provider;
  }

  getTranslations(): Promise<TranslationInfo[]> {
    return this.provider.getTranslations();
  }

  async getChapter(
    translationId: string,
    bookId: string,
    chapter: number
  ): Promise<ChapterResult> {
    const key = `${translationId}:${bookId}:${chapter}`;
    const hit = memoryCache.get(key);
    if (hit && hit.expires > Date.now()) {
      return hit.value;
    }

    const result = await this.provider.getChapter(
      translationId,
      bookId,
      chapter
    );
    memoryCache.set(key, { value: result, expires: Date.now() + CACHE_TTL });
    return result;
  }
}

export const bibleService = new BibleService();
