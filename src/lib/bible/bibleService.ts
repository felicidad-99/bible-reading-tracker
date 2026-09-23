import type {
  BibleServiceProvider,
  ChapterResult,
  TranslationInfo,
} from "./types";
import {
  BibleReferenceError,
  UnmappedTranslationError,
} from "./types";
import { HelloAoProvider } from "./helloaoProvider";
import { YouVersionProvider } from "./youversionProvider";

export type {
  BibleServiceProvider,
  ChapterResult,
  ChapterVerse,
  TranslationInfo,
} from "./types";
export { BibleReferenceError, UnmappedTranslationError } from "./types";
export { HelloAoProvider } from "./helloaoProvider";
export { YouVersionProvider } from "./youversionProvider";

const memoryCache = new Map<
  string,
  { value: ChapterResult; expires: number }
>();
const CACHE_TTL = 1000 * 60 * 60 * 24;

export function clearBibleCacheForTests(): void {
  memoryCache.clear();
}

export class BibleService {
  private primary: BibleServiceProvider | null;
  private fallback: BibleServiceProvider;

  constructor(
    primary: BibleServiceProvider | null = YouVersionProvider.isEnabled()
      ? new YouVersionProvider(process.env.YVP_APP_KEY as string)
      : null,
    fallback: BibleServiceProvider = new HelloAoProvider()
  ) {
    this.primary = primary;
    this.fallback = fallback;
  }

  async getTranslations(): Promise<TranslationInfo[]> {
    if (this.primary) {
      try {
        const list = await this.primary.getTranslations();
        if (list.length > 0) return list;
      } catch {
        // Fall through to Free Use API
      }
    }
    return this.fallback.getTranslations();
  }

  async getChapter(
    translationId: string,
    bookId: string,
    chapter: number
  ): Promise<ChapterResult> {
    const cacheKey = `${translationId}:${bookId}:${chapter}`;
    const hit = memoryCache.get(cacheKey);
    if (hit && hit.expires > Date.now()) {
      return hit.value;
    }

    let result: ChapterResult | null = null;
    let primaryError: unknown = null;

    if (this.primary) {
      try {
        result = await this.primary.getChapter(translationId, bookId, chapter);
      } catch (err) {
        if (err instanceof BibleReferenceError) throw err;
        primaryError = err;
        if (!(err instanceof UnmappedTranslationError)) {
          // Provider/transient failure → try Free Use API
        }
      }
    }

    if (!result) {
      try {
        result = await this.fallback.getChapter(
          translationId,
          bookId,
          chapter
        );
      } catch (err) {
        if (err instanceof BibleReferenceError) throw err;
        if (primaryError) throw primaryError;
        throw err;
      }
    }

    memoryCache.set(cacheKey, {
      value: result,
      expires: Date.now() + CACHE_TTL,
    });
    return result;
  }
}

export const bibleService = new BibleService();
