import type {
  BibleServiceProvider,
  ChapterResult,
  TranslationInfo,
} from "./types";
import { BibleReferenceError } from "./types";
import { HelloAoProvider } from "./helloaoProvider";
import { YouVersionProvider } from "./youversionProvider";
import { resolveTranslation } from "./translation-map";

export type {
  BibleServiceProvider,
  ChapterResult,
  ChapterVerse,
  TranslationInfo,
} from "./types";
export { BibleReferenceError } from "./types";
export { UnmappedTranslationError } from "./types";
export { HelloAoProvider } from "./helloaoProvider";
export { YouVersionProvider } from "./youversionProvider";

const memoryCache = new Map<
  string,
  { value: ChapterResult; expires: number }
>();
const CACHE_TTL = 1000 * 60 * 60 * 24;
const TRANSLATIONS_TTL = 1000 * 60 * 60;

const FRIENDLY_IDS: Record<string, string> = {
  KJV: "KJV",
  KJA: "KJVAP",
  CPB: "KJVCPB",
  ASV: "ASV",
  ABT: "ASVBT",
  DARBY: "DARBY",
  YLT: "YLT",
  BBE: "BBE",
  WEB: "WEB",
  WEBU: "WEBU",
  WEBPB: "WEBPB",
  WEBBE: "WEBBE",
  WMB: "WMB",
  WMBBE: "WMBBE",
  GNV: "GNV",
  RV1909: "RV1909",
  LSV: "LSV",
  FBV: "FBV",
  MSB: "MSB",
  T4T: "T4T",
  ULB: "ULB",
  WBS: "WBS",
  WYCLIFE: "WYCLIFE",
  AAB: "AAB",
};

const CANONICAL_ALIASES: Record<string, string> = {
  ENG_KJV: "KJV",
  ENGKJV: "KJV",
  KJV_APOCRYPHA: "KJVAP",
  ENG_KJA: "KJVAP",
  ENG_CPB: "KJVCPB",
  ENG_ASV: "ASV",
  ENG_ABT: "ASVBT",
  ENG_DBY: "DARBY",
  ENG_YLT: "YLT",
  ENG_BBE: "BBE",
  ENG_WEB: "WEB",
  ENG_WEBU: "WEBU",
  ENG_WEBPB: "WEBPB",
  ENG_WEU: "WEBBE",
  ENG_WEBBE: "WEBBE",
  ENG_WMB: "WMB",
  ENG_WMU: "WMBBE",
  ENG_GNV: "GNV",
  ENG_RV5: "RV1909",
  ENG_LSV: "LSV",
  ENG_FBV: "FBV",
  ENG_MSB: "MSB",
  ENG_T4T: "T4T",
  ENG_ULB: "ULB",
  ENG_WBS: "WBS",
  ENG_WYC2017: "WYCLIFE",
  ENG_WYC2018: "WYCLIFE",
  ENGWEBP: "WEB",
  ENGWEBPB: "WEBPB",
  ENGWEBU: "WEBU",
  ENGWEU: "WEBBE",
  ENGWEBUS: "WEB",
  WEBUS: "WEB",
};

const FREE_FALLBACK_IDS: Record<string, string> = {
  KJV: "eng_kjv",
  ENG_KJV: "eng_kjv",
  KJVAP: "eng_kja",
  ENG_KJA: "eng_kja",
  KJVCPB: "eng_cpb",
  ENG_CPB: "eng_cpb",
  ASV: "eng_asv",
  ENG_ASV: "eng_asv",
  ASVBT: "eng_abt",
  ENG_ABT: "eng_abt",
  DARBY: "eng_dby",
  ENG_DBY: "eng_dby",
  YLT: "eng_ylt",
  ENG_YLT: "eng_ylt",
  BBE: "eng_bbe",
  ENG_BBE: "eng_bbe",
  WEB: "eng_web",
  ENG_WEB: "eng_web",
  WEBU: "eng_webu",
  ENG_WEBU: "eng_webu",
  WEBPB: "eng_webpb",
  ENG_WEBPB: "eng_webpb",
  WEBBE: "eng_weu",
  ENG_WEU: "eng_weu",
  ENG_WEBBE: "eng_weu",
  WMB: "eng_wmb",
  ENG_WMB: "eng_wmb",
  WMBBE: "eng_wmu",
  ENG_WMU: "eng_wmu",
  GNV: "eng_gnv",
  ENG_GNV: "eng_gnv",
  RV1909: "eng_rv5",
  ENG_RV5: "eng_rv5",
  LSV: "eng_lsv",
  ENG_LSV: "eng_lsv",
  FBV: "eng_fbv",
  ENG_FBV: "eng_fbv",
  MSB: "eng_msb",
  ENG_MSB: "eng_msb",
  T4T: "eng_t4t",
  ENG_T4T: "eng_t4t",
  ULB: "eng_ulb",
  ENG_ULB: "eng_ulb",
  WBS: "eng_wbs",
  ENG_WBS: "eng_wbs",
  WYCLIFE: "eng_wyc2018",
  ENG_WYC2017: "eng_wyc2017",
  ENG_WYC2018: "eng_wyc2018",
  AAB: "AAB",
  BSB: "BSB",
  OEBUS: "OEBUS",
  "OEB-CW": "OEB-CW",
};

export function clearBibleCacheForTests(): void {
  memoryCache.clear();
}

function canonicalTranslationKey(id: string): string {
  const upper = id.trim().toUpperCase();
  return CANONICAL_ALIASES[upper] ?? upper;
}

function mergeTranslationLists(
  primary: TranslationInfo[],
  fallback: TranslationInfo[]
): TranslationInfo[] {
  const map = new Map<string, TranslationInfo>();

  for (const t of fallback) {
    const key = canonicalTranslationKey(t.id);
    if (map.has(key)) continue;
    const friendly = FRIENDLY_IDS[key];
    map.set(key, { ...t, id: friendly ?? t.id });
  }

  for (const t of primary) {
    const key = canonicalTranslationKey(t.id);
    map.set(key, { ...t, id: t.id });
  }

  return Array.from(map.values()).sort((a, b) =>
    (a.englishName || a.name || a.id).localeCompare(
      b.englishName || b.name || b.id,
      "en",
      { sensitivity: "base" }
    )
  );
}

export class BibleService {
  private primary: BibleServiceProvider | null;
  private fallback: BibleServiceProvider;
  private translationsCache: {
    value: TranslationInfo[];
    expires: number;
  } | null = null;

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
    if (this.translationsCache && this.translationsCache.expires > Date.now()) {
      return this.translationsCache.value;
    }

    const [primaryResult, fallbackResult] = await Promise.allSettled([
      this.primary ? this.primary.getTranslations() : Promise.resolve([]),
      this.fallback.getTranslations(),
    ]);

    const primary =
      primaryResult.status === "fulfilled" ? primaryResult.value : [];
    const fallback =
      fallbackResult.status === "fulfilled" ? fallbackResult.value : [];

    if (primary.length === 0 && fallback.length === 0) {
      if (fallbackResult.status === "rejected") {
        throw fallbackResult.reason;
      }
      if (primaryResult.status === "rejected") {
        throw primaryResult.reason;
      }
    }

    const merged = mergeTranslationLists(primary, fallback);
    this.translationsCache = {
      value: merged,
      expires: Date.now() + TRANSLATIONS_TTL,
    };
    return merged;
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
        // Real bad reference → surface as 404; anything else → Free Use fallback
        if (err instanceof BibleReferenceError) throw err;
        primaryError = err;
      }
    }

    if (!result) {
      const fallbackId = await mapToFallbackId(translationId);
      try {
        const fallbackResult = await this.fallback.getChapter(
          fallbackId,
          bookId,
          chapter
        );
        result = { ...fallbackResult, translationId };
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

async function mapToFallbackId(translationId: string): Promise<string> {
  try {
    const resolved = await resolveTranslation(translationId);
    if (resolved?.helloaoId) return resolved.helloaoId;
  } catch {
    // Ignore resolver failures and use static Free Use map below.
  }

  const key = translationId.trim().toUpperCase();
  return FREE_FALLBACK_IDS[key] ?? translationId;
}
