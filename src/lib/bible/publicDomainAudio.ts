import { getBookById, getBookIndex } from "@/lib/plan/bible-books";
import type { AudioProvider, AudioProviderResult } from "./audioTypes";

const ARCHIVE_BASE = "https://archive.org/download/kjvmp3";
const ITEM_ID = "kjvmp3";

const ARCHIVE_CODE: Record<string, string> = {
  JDG: "JUD",
  JUD: "JDE",
  SNG: "SON",
  MRK: "MAR",
  JHN: "JOH",
  JAS: "JAM",
  JOL: "JOE",
  NAM: "NAH",
  EZK: "EZE",
  "1JN": "1JO",
  "2JN": "2JO",
  "3JN": "3JO",
};

const KNOWN_MISSING = new Set(["GAL:7"]);

export function buildPublicDomainUrl(
  bookId: string,
  chapter: number
): string | null {
  const book = getBookById(bookId);
  if (!book) return null;
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) {
    return null;
  }
  if (KNOWN_MISSING.has(`${bookId}:${chapter}`)) return null;

  const index = getBookIndex(bookId) + 1;
  if (index < 1 || index > 66) return null;

  const code = ARCHIVE_CODE[bookId] ?? bookId;
  const nn = String(index).padStart(2, "0");
  const ch = String(chapter).padStart(2, "0");
  return `${ARCHIVE_BASE}/${nn}_${code}_${ch}.mp3`;
}

export function isKnownMissingChapter(bookId: string, chapter: number): boolean {
  return KNOWN_MISSING.has(`${bookId}:${chapter}`);
}

export class PublicDomainAudioProvider implements AudioProvider {
  readonly name = "publicdomain" as const;

  isEnabled(): boolean {
    return true;
  }

  async getChapter(
    _translationId: string,
    bookId: string,
    chapter: number
  ): Promise<AudioProviderResult | null> {
    const url = buildPublicDomainUrl(bookId, chapter);
    if (!url) return null;

    return {
      source: "publicdomain",
      upstreamUrl: url,
      translationId: "KJV",
      translationName: "King James Version",
      copyright:
        "Public domain KJV audio via Internet Archive (item kjvmp3).",
    };
  }
}

export const PUBLIC_DOMAIN_ITEM_ID = ITEM_ID;
