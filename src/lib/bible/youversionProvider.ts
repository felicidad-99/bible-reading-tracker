import type {
  BibleServiceProvider,
  ChapterResult,
  ChapterVerse,
  TranslationInfo,
} from "./types";
import { BibleReferenceError, UnmappedTranslationError } from "./types";
import { loadBibleMeta, resolveTranslation } from "./translation-map";
import { getBookById } from "@/lib/plan/bible-books";

const BASE_URL = "https://api.youversion.com/v1";

interface YvVersesResponse {
  data?: Array<{
    id?: string | number;
    passage_id?: string;
    title?: string | number;
  }>;
  content?: string;
  reference?: string;
}

export class YouVersionProvider implements BibleServiceProvider {
  private appKey: string;
  private fetchImpl: typeof fetch;

  constructor(appKey: string, fetchImpl: typeof fetch = fetch) {
    this.appKey = appKey;
    this.fetchImpl = fetchImpl;
  }

  static isEnabled(): boolean {
    return Boolean(process.env.YVP_APP_KEY);
  }

  private headers(): HeadersInit {
    return {
      "X-YVP-App-Key": this.appKey,
      Accept: "application/json",
    };
  }

  async getTranslations(): Promise<TranslationInfo[]> {
    const results: TranslationInfo[] = [];
    let pageToken: string | undefined;
    let pages = 0;

    do {
      const url = new URL(`${BASE_URL}/bibles`);
      url.searchParams.append("language_ranges[]", "en");
      if (pageToken) url.searchParams.set("page_token", pageToken);

      const res = await this.fetchImpl(url, { headers: this.headers() });
      if (!res.ok) {
        throw new Error(`YouVersion translations returned ${res.status}`);
      }

      const data = (await res.json()) as {
        data?: Array<{
          id?: number;
          abbreviation?: string;
          title?: string;
          localized_title?: string;
          language?: { iso_639_1?: string; name?: string };
          language_tag?: string;
          books?: string[];
        }>;
        next_page_token?: string;
      };

      for (const item of data.data ?? []) {
        if (typeof item.id !== "number" || !item.abbreviation) continue;
        const iso = item.language?.iso_639_1 ?? "";
        const langTag = item.language_tag ?? "";
        if (iso && iso !== "en" && !iso.startsWith("en")) continue;
        if (!iso && langTag && !langTag.toLowerCase().startsWith("en")) continue;

        const books = item.books ?? [];
        if (books.length > 0 && !(books.includes("GEN") && books.includes("REV"))) {
          continue;
        }

        const title = item.localized_title ?? item.title ?? item.abbreviation;
        results.push({
          id: item.abbreviation,
          name: title,
          englishName: title,
          language: iso || "eng",
          languageEnglishName: item.language?.name ?? "English",
          shortName: item.abbreviation,
          textDirection: "ltr",
          numberOfBooks: books.length || 66,
          totalNumberOfChapters: 1189,
        });
      }

      pageToken = data.next_page_token;
      pages += 1;
    } while (pageToken && pages < 30);

    return results;
  }

  async getChapter(
    translationId: string,
    bookId: string,
    chapter: number
  ): Promise<ChapterResult> {
    const resolved = await resolveTranslation(translationId, this.fetchImpl);
    if (!resolved) {
      throw new UnmappedTranslationError(translationId);
    }

    const versesUrl = `${BASE_URL}/bibles/${resolved.yvId}/books/${encodeURIComponent(
      bookId
    )}/chapters/${chapter}/verses`;
    const versesRes = await this.fetchImpl(versesUrl, {
      headers: this.headers(),
    });

    if (versesRes.status === 404) {
      const bibleExists = await this.bibleExists(resolved.yvId);
      if (!bibleExists) {
        throw new UnmappedTranslationError(translationId);
      }
      throw new BibleReferenceError(
        `${bookId} ${chapter} is not a valid reference`
      );
    }

    let verseNumbers: number[] | null = null;
    if (versesRes.ok) {
      const body = (await versesRes.json()) as YvVersesResponse;
      verseNumbers = parseVerseNumbers(body);
    }

    const htmlVerses = await this.fetchPassageHtml(
      resolved.yvId,
      bookId,
      chapter
    );
    if (htmlVerses.length > 0) {
      const ordered =
        verseNumbers && verseNumbers.length > 0
          ? orderByNumbers(htmlVerses, verseNumbers)
          : htmlVerses;
      return this.finishChapter(
        resolved.yvId,
        translationId,
        resolved,
        bookId,
        chapter,
        ordered
      );
    }

    const textVerses = await this.fetchPassageText(
      resolved.yvId,
      bookId,
      chapter
    );
    if (textVerses.length > 0) {
      return this.finishChapter(
        resolved.yvId,
        translationId,
        resolved,
        bookId,
        chapter,
        textVerses
      );
    }

    throw new Error("YouVersion returned empty chapter content");
  }

  private async bibleExists(yvId: number): Promise<boolean> {
    try {
      const res = await this.fetchImpl(`${BASE_URL}/bibles/${yvId}`, {
        headers: this.headers(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private async fetchPassageHtml(
    yvId: number,
    bookId: string,
    chapter: number
  ): Promise<ChapterVerse[]> {
    const url = `${BASE_URL}/bibles/${yvId}/passages/${encodeURIComponent(
      `${bookId}.${chapter}`
    )}?format=html&include_headings=false&include_notes=false`;
    const res = await this.fetchImpl(url, { headers: this.headers() });

    if (res.status === 404) {
      if (!(await this.bibleExists(yvId))) {
        throw new UnmappedTranslationError(String(yvId));
      }
      throw new BibleReferenceError(
        `${bookId} ${chapter} is not a valid reference`
      );
    }
    if (!res.ok) return [];

    const body = (await res.json()) as { content?: string };
    return parseHtmlVerses(body.content ?? "");
  }

  private async fetchPassageText(
    yvId: number,
    bookId: string,
    chapter: number
  ): Promise<ChapterVerse[]> {
    const url = `${BASE_URL}/bibles/${yvId}/passages/${encodeURIComponent(
      `${bookId}.${chapter}`
    )}?format=text`;
    const res = await this.fetchImpl(url, { headers: this.headers() });

    if (res.status === 404) {
      if (!(await this.bibleExists(yvId))) {
        throw new UnmappedTranslationError(String(yvId));
      }
      throw new BibleReferenceError(
        `${bookId} ${chapter} is not a valid reference`
      );
    }
    if (!res.ok) return [];

    const body = (await res.json()) as { content?: string };
    return parsePassageText(body.content ?? "");
  }

  private async finishChapter(
    yvId: number,
    translationId: string,
    resolved: Awaited<ReturnType<typeof resolveTranslation>>,
    bookId: string,
    chapter: number,
    verses: ChapterVerse[]
  ): Promise<ChapterResult> {
    const meta = (await loadBibleMeta(yvId, this.fetchImpl)) ?? resolved;
    const name = meta?.title ?? meta?.yvAbbrev ?? translationId;
    const book = getBookById(bookId);

    return {
      bookId,
      bookName: book?.name ?? bookId,
      chapter,
      translationId,
      translationName: name,
      verses,
      copyright: meta?.copyright,
      source: "youversion",
    };
  }
}

function parseVerseNumbers(body: YvVersesResponse): number[] {
  const items = Array.isArray(body.data) ? body.data : [];
  const numbers: number[] = [];
  for (const item of items) {
    const title = item.title;
    if (typeof title === "number") {
      numbers.push(title);
      continue;
    }
    if (typeof title === "string" && /^\d+$/.test(title)) {
      numbers.push(Number(title));
      continue;
    }
    if (typeof item.id === "number") {
      numbers.push(item.id);
      continue;
    }
    if (typeof item.id === "string" && /^\d+$/.test(item.id)) {
      numbers.push(Number(item.id));
    }
  }
  return numbers;
}

function orderByNumbers(
  verses: ChapterVerse[],
  numbers: number[]
): ChapterVerse[] {
  const byNumber = new Map(verses.map((v) => [v.number, v]));
  const ordered: ChapterVerse[] = [];
  for (const n of numbers) {
    const hit = byNumber.get(n);
    if (hit) {
      ordered.push(hit);
      byNumber.delete(n);
    }
  }
  for (const leftover of byNumber.values()) {
    ordered.push(leftover);
  }
  return ordered;
}

export function parseHtmlVerses(html: string): ChapterVerse[] {
  if (!html.trim()) return [];

  const marker =
    /<span[^>]*\bclass="[^"]*yv-v[^"]*"[^>]*\bv="(\d+)"[^>]*>\s*<\/span>\s*<span[^>]*\bclass="[^"]*yv-vlbl[^"]*"[^>]*>\s*(\d+)\s*<\/span>/gi;
  const matches: Array<{ number: number; index: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = marker.exec(html)) !== null) {
    const number = Number(match[2] || match[1]);
    matches.push({ number, index: match.index });
  }

  if (matches.length === 0) {
    const loose = /<span[^>]*\bv="(\d+)"[^>]*>[\s\S]*?<\/span>\s*(?:<span[^>]*\bv="|\s*$)/gi;
    while ((match = loose.exec(html)) !== null) {
      matches.push({ number: Number(match[1]), index: match.index });
    }
  }

  if (matches.length === 0) {
    const plain = stripTags(html).trim();
    if (!plain) return [];
    return [{ number: 1, text: plain }];
  }

  const verses: ChapterVerse[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : html.length;
    let slice = html.slice(start, end);
    const labelOpen = slice.search(/class="[^"]*yv-vlbl[^"]*"/i);
    if (labelOpen !== -1) {
      const labelClose = slice.indexOf("</span>", labelOpen);
      if (labelClose !== -1) {
        slice = slice.slice(labelClose + "</span>".length);
      }
    }
    const text = stripTags(slice)
      .replace(/\s+/g, " ")
      .trim();
    if (text) {
      verses.push({ number: matches[i].number, text });
    }
  }

  return verses;
}

function parsePassageText(content: string): ChapterVerse[] {
  const cleaned = content.replace(/\r/g, "").trim();
  if (!cleaned) return [];

  const marker = /(?:^|\n)\s*(\d{1,3})\s+([^\n]+)/g;
  const verses: ChapterVerse[] = [];
  let match: RegExpExecArray | null;
  while ((match = marker.exec(cleaned)) !== null) {
    const number = Number(match[1]);
    const text = match[2].trim();
    if (!text) continue;
    verses.push({ number, text });
  }

  if (verses.length >= 2) return verses;
  return [{ number: 1, text: cleaned }];
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–");
}
