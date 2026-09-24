export type AudioSource = "biblebrain" | "publicdomain";

export interface VerseTiming {
  verse: number;
  start: number;
  end?: number;
}

export interface AudioChapterMeta {
  available: boolean;
  source?: AudioSource;
  streamUrl?: string;
  translationId?: string;
  translationName?: string;
  copyright?: string;
  verseTimings?: VerseTiming[];
  reason?: string;
}

export interface AudioProviderResult {
  source: AudioSource;
  upstreamUrl: string;
  translationId: string;
  translationName: string;
  copyright?: string;
  verseTimings?: VerseTiming[];
}

export interface AudioProvider {
  readonly name: AudioSource;
  isEnabled(): boolean;
  getChapter(
    translationId: string,
    bookId: string,
    chapter: number
  ): Promise<AudioProviderResult | null>;
}
