import type {
  AudioProvider,
  AudioProviderResult,
  VerseTiming,
} from "./audioTypes";

const BRAIN_BASE = process.env.BRAIN_API_URL || "https://4.dbt.io/api";
const CACHE_TTL = 1000 * 60 * 60;

interface BrainBible {
  dam_id?: string;
  damId?: string;
  id?: string;
  abbreviation?: string;
  abb?: string;
  language_code?: string;
  languageCode?: string;
  name?: string;
}

interface BrainCache {
  value: BrainBible[];
  expires: number;
}

function apiKey(): string | null {
  const key = process.env.BRAIN_API_KEY?.trim();
  return key && key.length >= 8 ? key : null;
}

function toSeconds(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
    const parts = value.split(":").map(Number);
    if (parts.every((p) => Number.isFinite(p))) {
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      if (parts.length === 2) return parts[0] * 60 + parts[1];
    }
  }
  return Number.NaN;
}

function verseNumberFrom(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const match = raw.match(/(\d+)\s*$/);
    if (match) return Number(match[1]);
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return Number.NaN;
}

function normalizeTimings(raw: unknown): VerseTiming[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const timings: VerseTiming[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const verse = verseNumberFrom(
      obj.verse ?? obj.verseNumber ?? obj.verseId ?? obj.v ?? obj.verse_id
    );
    const start = toSeconds(obj.start ?? obj.startSeconds ?? obj.begin ?? obj.t);
    if (!Number.isFinite(verse) || !Number.isFinite(start)) continue;
    const endRaw = obj.end ?? obj.endSeconds ?? obj.stop;
    const end = endRaw !== undefined ? toSeconds(endRaw) : undefined;
    timings.push({
      verse,
      start,
      end: end !== undefined && Number.isFinite(end) ? end : undefined,
    });
  }
  timings.sort((a, b) => a.start - b.start || a.verse - b.verse);
  return timings.length > 0 ? timings : undefined;
}

function extractChapterPayload(data: unknown): {
  url?: string;
  timings?: VerseTiming[];
  copyright?: string;
  translationName?: string;
} {
  const root = (data ?? {}) as Record<string, unknown>;
  const payload = (root.data ?? root) as Record<string, unknown>;
  const candidates = [
    payload.resourceUrl,
    payload.resource_url,
    payload.audio_url,
    payload.audioUrl,
    payload.download_url,
    payload.downloadUrl,
    payload.url,
    payload.mp3,
    payload.src,
  ];
  let url: string | undefined;
  for (const c of candidates) {
    if (typeof c === "string" && /^https?:\/\//i.test(c)) {
      url = c;
      break;
    }
  }

  const timings =
    normalizeTimings(payload.verseTimings) ??
    normalizeTimings(payload.verse_timings) ??
    normalizeTimings(payload.timecodes) ??
    normalizeTimings(payload.timings) ??
    normalizeTimings(payload.timestamps);

  const copyright =
    typeof payload.copyright === "string" ? payload.copyright : undefined;
  const translationName =
    typeof payload.name === "string"
      ? payload.name
      : typeof payload.abbreviation === "string"
        ? payload.abbreviation
        : undefined;

  return { url, timings, copyright, translationName };
}

export class BibleBrainAudioProvider implements AudioProvider {
  readonly name = "biblebrain" as const;
  private cache: BrainCache | null = null;

  isEnabled(): boolean {
    return apiKey() !== null;
  }

  async getChapter(
    translationId: string,
    bookId: string,
    chapter: number
  ): Promise<AudioProviderResult | null> {
    const key = apiKey();
    if (!key) return null;

    const bible = await this.findBible(translationId);
    if (!bible) return null;

    const damId = bible.dam_id ?? bible.damId ?? bible.id;
    if (!damId) return null;

    const url =
      `${BRAIN_BASE}/bibles/${encodeURIComponent(damId)}` +
      `/books/${encodeURIComponent(bookId)}` +
      `/chapters/${chapter}?key=${encodeURIComponent(key)}`;

    let res: Response;
    try {
      res = await fetch(url, { next: { revalidate: 3600 } });
    } catch {
      return null;
    }
    if (res.status === 404) return null;
    if (!res.ok) return null;

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return null;
    }

    const parsed = extractChapterPayload(data);
    if (!parsed.url) return null;

    const abbreviation =
      bible.abbreviation ?? bible.abb ?? translationId;
    return {
      source: "biblebrain",
      upstreamUrl: parsed.url,
      translationId: abbreviation,
      translationName: parsed.translationName ?? bible.name ?? abbreviation,
      copyright: parsed.copyright,
      verseTimings: parsed.timings,
    };
  }

  private async findBible(translationId: string): Promise<BrainBible | null> {
    const key = apiKey();
    if (!key) return null;

    let list: BrainBible[];
    if (this.cache && this.cache.expires > Date.now()) {
      list = this.cache.value;
    } else {
      try {
        const res = await fetch(
          `${BRAIN_BASE}/bibles?language_code=eng&key=${encodeURIComponent(key)}`,
          { next: { revalidate: 3600 } }
        );
        if (!res.ok) return null;
        const data = (await res.json()) as { data?: BrainBible[] };
        list = Array.isArray(data.data) ? data.data : [];
        this.cache = { value: list, expires: Date.now() + CACHE_TTL };
      } catch {
        return null;
      }
    }

    const want = translationId.trim().toUpperCase();
    const exact = list.find((b) => {
      const abb = (b.abbreviation ?? b.abb ?? "").toUpperCase();
      return abb === want;
    });
    if (exact) return exact;

    const starts = list.find((b) => {
      const abb = (b.abbreviation ?? b.abb ?? "").toUpperCase();
      return abb.startsWith(want) || want.startsWith(abb);
    });
    if (starts && (starts.abbreviation ?? starts.abb)) return starts;

    const kjvish =
      want === "KJV" || want === "ENG_KJV" || want === "ENGKJV";
    if (kjvish) {
      return (
        list.find((b) => {
          const abb = (b.abbreviation ?? b.abb ?? "").toUpperCase();
          return abb === "KJV" || abb === "AKJV";
        }) ?? null
      );
    }

    return null;
  }
}
