export interface ResolvedTranslation {
  yvId: number;
  yvAbbrev: string;
  title?: string;
  copyright?: string;
  helloaoId?: string;
}

const SEED: ResolvedTranslation[] = [
  {
    yvId: 3034,
    yvAbbrev: "BSB",
    title: "Berean Standard Bible",
    helloaoId: "BSB",
  },
  {
    yvId: 1,
    yvAbbrev: "KJV",
    title: "King James Version",
    helloaoId: "eng_kjv",
  },
  {
    yvId: 12,
    yvAbbrev: "ASV",
    title: "American Standard Version",
    helloaoId: "eng_asv",
  },
  {
    yvId: 206,
    yvAbbrev: "WEBUS",
    title: "World English Bible, American English Edition",
    helloaoId: "ENGWEBP",
  },
  {
    yvId: 111,
    yvAbbrev: "NIV",
    title: "New International Version",
  },
];

const ALIASES = new Map<string, number>([
  ["BSB", 3034],
  ["KJV", 1],
  ["ENG_KJV", 1],
  ["ASV", 12],
  ["ENG_ASV", 12],
  ["WEBUS", 206],
  ["WEB", 206],
  ["ENGWEBP", 206],
  ["ENG_WEB", 206],
  ["ENG_WEBPB", 206],
  ["ENG_WEBU", 206],
  ["ENG_WEU", 206],
  ["NIV", 111],
]);

let dynamic: Map<string, number> | null = null;
let dynamicExpires = 0;
const DYNAMIC_TTL = 1000 * 60 * 60 * 24;

const metaCache = new Map<number, ResolvedTranslation>();
const META_TTL = 1000 * 60 * 60 * 24;
const metaExpires = new Map<number, number>();

export function resetTranslationMapForTests(): void {
  dynamic = null;
  dynamicExpires = 0;
  metaCache.clear();
  metaExpires.clear();
}

export async function loadDynamicCatalog(
  fetchImpl: typeof fetch = fetch
): Promise<Map<string, number>> {
  if (dynamic && dynamicExpires > Date.now()) return dynamic;
  if (!process.env.YVP_APP_KEY) return new Map();

  const map = new Map<string, number>();
  let pageToken: string | undefined;
  let pages = 0;

  try {
    do {
      const url = new URL("https://api.youversion.com/v1/bibles");
      url.searchParams.append("language_ranges[]", "en");
      if (pageToken) url.searchParams.set("page_token", pageToken);

      const res = await fetchImpl(url, {
        headers: {
          "X-YVP-App-Key": process.env.YVP_APP_KEY,
          Accept: "application/json",
        },
      });
      if (!res.ok) break;

      const data = (await res.json()) as {
        data?: Array<{
          id?: number;
          abbreviation?: string;
          title?: string;
        }>;
        next_page_token?: string;
      };

      for (const item of data.data ?? []) {
        if (typeof item.id === "number" && item.abbreviation) {
          map.set(normalize(item.abbreviation), item.id);
        }
      }
      pageToken = data.next_page_token;
      pages += 1;
    } while (pageToken && pages < 30);
  } catch {
    // Catalog is best-effort; static aliases still work.
  }

  dynamic = map;
  dynamicExpires = Date.now() + DYNAMIC_TTL;
  return map;
}

export async function resolveTranslation(
  translationId: string,
  fetchImpl: typeof fetch = fetch
): Promise<ResolvedTranslation | null> {
  const key = normalize(translationId);

  if (/^\d+$/.test(key)) {
    const yvId = Number(key);
    const seed = SEED.find((s) => s.yvId === yvId);
    if (seed) return seed;
    return (await loadBibleMeta(yvId, fetchImpl)) ?? {
      yvId,
      yvAbbrev: String(yvId),
    };
  }

  const aliasId = ALIASES.get(key);
  if (aliasId !== undefined) {
    const seed = SEED.find((s) => s.yvId === aliasId);
    if (seed) return seed;
    return { yvId: aliasId, yvAbbrev: translationId };
  }

  const seed = SEED.find((s) => normalize(s.yvAbbrev) === key);
  if (seed) return seed;

  const catalog = await loadDynamicCatalog(fetchImpl);
  const dynId = catalog.get(key);
  if (dynId !== undefined) {
    const known = SEED.find((s) => s.yvId === dynId);
    if (known) return known;
    const meta = await loadBibleMeta(dynId, fetchImpl);
    if (meta) return meta;
    return { yvId: dynId, yvAbbrev: translationId };
  }

  return null;
}

export async function loadBibleMeta(
  yvId: number,
  fetchImpl: typeof fetch = fetch
): Promise<ResolvedTranslation | null> {
  const cached = metaCache.get(yvId);
  const expires = metaExpires.get(yvId) ?? 0;
  if (cached && expires > Date.now()) return cached;
  if (!process.env.YVP_APP_KEY) return null;

  try {
    const res = await fetchImpl(`https://api.youversion.com/v1/bibles/${yvId}`, {
      headers: {
        "X-YVP-App-Key": process.env.YVP_APP_KEY,
        Accept: "application/json",
      },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      id?: number;
      abbreviation?: string;
      title?: string;
      copyright?: string;
    };
    const resolved: ResolvedTranslation = {
      yvId: data.id ?? yvId,
      yvAbbrev: data.abbreviation ?? String(yvId),
      title: data.title,
      copyright: data.copyright,
      helloaoId: SEED.find((s) => s.yvId === yvId)?.helloaoId,
    };
    metaCache.set(yvId, resolved);
    metaExpires.set(yvId, Date.now() + META_TTL);
    return resolved;
  } catch {
    return null;
  }
}

function normalize(value: string): string {
  return value.trim().toUpperCase();
}
