import type {
  BibleServiceProvider,
  ChapterResult,
  ChapterVerse,
  TranslationInfo,
} from "./types";
import { BibleReferenceError } from "./types";

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
  "eng_kjv",
  "ENGWEBP",
  "eng_web",
  "eng_webpb",
  "eng_webu",
  "eng_weu",
  "eng_asv",
  "eng_abt",
  "eng_bbe",
  "eng_dby",
  "eng_ylt",
  "eng_wbs",
  "eng_gnv",
  "eng_rv5",
  "eng_lsv",
  "eng_msb",
  "eng_fbv",
  "eng_t4t",
  "eng_ulb",
  "eng_wmb",
  "eng_wmu",
  "eng_wyc2017",
  "eng_wyc2018",
  "eng_cpb",
  "eng_kja",
  "AAB",
]);

const LICENSE_BLOCKLIST = new Set([
  "eng_net", // NET Bible: free non-commercial only
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
      if (LICENSE_BLOCKLIST.has(t.id)) return false;
      if (t.language && t.language !== "eng" && !t.language.startsWith("eng")) {
        return false;
      }
      if (FREE_TRANSLATIONS.has(t.id)) return true;
      const license = (t as { licenseUrl?: string }).licenseUrl ?? "";
      if (/public[-_ ]?domain|creativecommons\.org\/publicdomain|cc0/i.test(license)) {
        return true;
      }
      if (/ebible\.org|helloao\.org/i.test(license) && /eng/i.test(t.id)) {
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
      translationId,
      translationName:
        data?.translation?.englishName ??
        data?.translation?.name ??
        translationId,
      verses,
      source: "helloao",
    };
  }
}
