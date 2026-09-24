import type {
  AudioChapterMeta,
  AudioProvider,
  AudioProviderResult,
} from "./audioTypes";
import { BibleBrainAudioProvider } from "./bibleBrainAudio";
import {
  PublicDomainAudioProvider,
  isKnownMissingChapter,
} from "./publicDomainAudio";

export type {
  AudioChapterMeta,
  AudioProvider,
  AudioProviderResult,
  AudioSource,
  VerseTiming,
} from "./audioTypes";
export {
  PublicDomainAudioProvider,
  buildPublicDomainUrl,
  isKnownMissingChapter,
} from "./publicDomainAudio";
export { BibleBrainAudioProvider } from "./bibleBrainAudio";

export function audioStreamPath(
  translationId: string,
  bookId: string,
  chapter: number
): string {
  return `/api/bible/audio/stream/${translationId}/${bookId}/${chapter}`;
}

export function audioMetaPath(
  translationId: string,
  bookId: string,
  chapter: number
): string {
  return `/api/bible/audio/meta/${translationId}/${bookId}/${chapter}`;
}

export class AudioService {
  private primary: AudioProvider;
  private fallback: AudioProvider;

  constructor(
    primary: AudioProvider = new BibleBrainAudioProvider(),
    fallback: AudioProvider = new PublicDomainAudioProvider()
  ) {
    this.primary = primary;
    this.fallback = fallback;
  }

  async resolve(
    translationId: string,
    bookId: string,
    chapter: number
  ): Promise<AudioProviderResult | null> {
    if (this.primary.isEnabled()) {
      try {
        const primary = await this.primary.getChapter(
          translationId,
          bookId,
          chapter
        );
        if (primary) return primary;
      } catch {
        // Fall through to public-domain audio.
      }
    }

    try {
      return await this.fallback.getChapter(translationId, bookId, chapter);
    } catch {
      return null;
    }
  }

  async getMeta(
    translationId: string,
    bookId: string,
    chapter: number
  ): Promise<AudioChapterMeta> {
    if (isKnownMissingChapter(bookId, chapter)) {
      return {
        available: false,
        reason: "Audio is not available for this chapter yet.",
      };
    }

    const resolved = await this.resolve(translationId, bookId, chapter);
    if (!resolved) {
      return {
        available: false,
        reason: "Audio is not available for this chapter.",
      };
    }

    return {
      available: true,
      source: resolved.source,
      streamUrl: audioStreamPath(translationId, bookId, chapter),
      translationId: resolved.translationId,
      translationName: resolved.translationName,
      copyright: resolved.copyright,
      verseTimings: resolved.verseTimings,
    };
  }
}

export const audioService = new AudioService();
