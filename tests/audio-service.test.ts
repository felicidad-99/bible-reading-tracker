import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  AudioService,
  buildPublicDomainUrl,
  isKnownMissingChapter,
  audioMetaPath,
  audioStreamPath,
} from "@/lib/bible/audioService";
import type { AudioProvider, AudioProviderResult } from "@/lib/bible/audioTypes";
import { BibleBrainAudioProvider } from "@/lib/bible/bibleBrainAudio";
import { PublicDomainAudioProvider } from "@/lib/bible/publicDomainAudio";

function result(
  overrides: Partial<AudioProviderResult> = {}
): AudioProviderResult {
  return {
    source: "publicdomain",
    upstreamUrl: "https://archive.org/download/kjvmp3/01_GEN_01.mp3",
    translationId: "KJV",
    translationName: "King James Version",
    ...overrides,
  };
}

class StubProvider implements AudioProvider {
  constructor(
    public name: AudioProvider["name"],
    private impl: () => Promise<AudioProviderResult | null>,
    private enabled = true
  ) {}
  isEnabled() {
    return this.enabled;
  }
  getChapter() {
    return this.impl();
  }
}

describe("buildPublicDomainUrl", () => {
  it("builds Genesis 1", () => {
    expect(buildPublicDomainUrl("GEN", 1)).toBe(
      "https://archive.org/download/kjvmp3/01_GEN_01.mp3"
    );
  });

  it("maps app book ids to archive codes", () => {
    expect(buildPublicDomainUrl("JHN", 3)).toBe(
      "https://archive.org/download/kjvmp3/43_JOH_03.mp3"
    );
    expect(buildPublicDomainUrl("JDG", 1)).toBe(
      "https://archive.org/download/kjvmp3/07_JUD_01.mp3"
    );
    expect(buildPublicDomainUrl("JUD", 1)).toBe(
      "https://archive.org/download/kjvmp3/65_JDE_01.mp3"
    );
    expect(buildPublicDomainUrl("MRK", 16)).toBe(
      "https://archive.org/download/kjvmp3/41_MAR_16.mp3"
    );
    expect(buildPublicDomainUrl("1JN", 1)).toBe(
      "https://archive.org/download/kjvmp3/62_1JO_01.mp3"
    );
    expect(buildPublicDomainUrl("SNG", 8)).toBe(
      "https://archive.org/download/kjvmp3/22_SON_08.mp3"
    );
    expect(buildPublicDomainUrl("EZK", 1)).toBe(
      "https://archive.org/download/kjvmp3/26_EZE_01.mp3"
    );
  });

  it("zero-pads chapters including 100+", () => {
    expect(buildPublicDomainUrl("PSA", 100)).toBe(
      "https://archive.org/download/kjvmp3/19_PSA_100.mp3"
    );
    expect(buildPublicDomainUrl("PSA", 9)).toBe(
      "https://archive.org/download/kjvmp3/19_PSA_09.mp3"
    );
  });

  it("rejects invalid references and known gaps", () => {
    expect(buildPublicDomainUrl("XYZ", 1)).toBeNull();
    expect(buildPublicDomainUrl("GEN", 0)).toBeNull();
    expect(buildPublicDomainUrl("GEN", 51)).toBeNull();
    expect(buildPublicDomainUrl("GAL", 7)).toBeNull();
    expect(isKnownMissingChapter("GAL", 7)).toBe(true);
    expect(isKnownMissingChapter("GAL", 6)).toBe(false);
  });
});

describe("audio paths", () => {
  it("builds meta and stream paths", () => {
    expect(audioMetaPath("KJV", "JHN", 3)).toBe(
      "/api/bible/audio/meta/KJV/JHN/3"
    );
    expect(audioStreamPath("KJV", "JHN", 3)).toBe(
      "/api/bible/audio/stream/KJV/JHN/3"
    );
  });
});

describe("AudioService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses primary when enabled", async () => {
    const primary = new StubProvider(
      "biblebrain",
      async () => result({ source: "biblebrain", verseTimings: [{ verse: 1, start: 0 }] })
    );
    const fallback = new StubProvider("publicdomain", async () => result());
    const service = new AudioService(primary, fallback);

    const meta = await service.getMeta("KJV", "JHN", 3);
    expect(meta.available).toBe(true);
    expect(meta.source).toBe("biblebrain");
    expect(meta.verseTimings).toEqual([{ verse: 1, start: 0 }]);
    expect(meta.streamUrl).toBe("/api/bible/audio/stream/KJV/JHN/3");
  });

  it("falls back to public domain when primary disabled", async () => {
    const primary = new StubProvider(
      "biblebrain",
      async () => result({ source: "biblebrain" }),
      false
    );
    const fallback = new StubProvider("publicdomain", async () => result());
    const service = new AudioService(primary, fallback);

    const meta = await service.getMeta("KJV", "GEN", 1);
    expect(meta.available).toBe(true);
    expect(meta.source).toBe("publicdomain");
    expect(meta.verseTimings).toBeUndefined();
  });

  it("falls back when primary throws", async () => {
    const primary = new StubProvider("biblebrain", async () => {
      throw new Error("brain down");
    });
    const fallback = new StubProvider("publicdomain", async () => result());
    const service = new AudioService(primary, fallback);

    const meta = await service.getMeta("KJV", "GEN", 1);
    expect(meta.available).toBe(true);
    expect(meta.source).toBe("publicdomain");
  });

  it("returns unavailable for known missing chapter", async () => {
    const primary = new StubProvider("biblebrain", async () => result());
    const fallback = new StubProvider("publicdomain", async () => result());
    const service = new AudioService(primary, fallback);

    const meta = await service.getMeta("KJV", "GAL", 7);
    expect(meta.available).toBe(false);
    expect(meta.reason).toMatch(/not available/i);
  });

  it("returns unavailable when all providers return null", async () => {
    const primary = new StubProvider("biblebrain", async () => null, true);
    const fallback = new StubProvider("publicdomain", async () => null);
    const service = new AudioService(primary, fallback);

    const meta = await service.getMeta("NOPE", "GEN", 1);
    expect(meta.available).toBe(false);
  });
});

describe("PublicDomainAudioProvider", () => {
  it("always enabled and resolves KJV metadata", async () => {
    const provider = new PublicDomainAudioProvider();
    expect(provider.isEnabled()).toBe(true);
    const res = await provider.getChapter("BSB", "JHN", 3);
    expect(res).not.toBeNull();
    expect(res?.source).toBe("publicdomain");
    expect(res?.translationId).toBe("KJV");
    expect(res?.upstreamUrl).toContain("43_JOH_03.mp3");
    expect(res?.verseTimings).toBeUndefined();
  });

  it("returns null for missing chapter", async () => {
    const provider = new PublicDomainAudioProvider();
    expect(await provider.getChapter("KJV", "GAL", 7)).toBeNull();
  });
});

describe("BibleBrainAudioProvider", () => {
  const original = process.env.BRAIN_API_KEY;

  afterEach(() => {
    if (original === undefined) delete process.env.BRAIN_API_KEY;
    else process.env.BRAIN_API_KEY = original;
  });

  it("is disabled without key", () => {
    delete process.env.BRAIN_API_KEY;
    expect(new BibleBrainAudioProvider().isEnabled()).toBe(false);
  });

  it("is enabled with key", () => {
    process.env.BRAIN_API_KEY = "test-key-123456";
    expect(new BibleBrainAudioProvider().isEnabled()).toBe(true);
  });

  it("returns null immediately when disabled", async () => {
    delete process.env.BRAIN_API_KEY;
    const provider = new BibleBrainAudioProvider();
    expect(await provider.getChapter("KJV", "JHN", 3)).toBeNull();
  });
});
