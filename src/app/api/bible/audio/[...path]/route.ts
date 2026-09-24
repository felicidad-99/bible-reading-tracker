import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { audioService } from "@/lib/bible/audioService";

const FORWARD_HEADERS = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "cache-control",
];

function invalidReference(): NextResponse {
  return NextResponse.json({ error: "Invalid reference" }, { status: 400 });
}

function parsePath(path: string[]):
  | { kind: "meta" | "stream"; translationId: string; bookId: string; chapter: number }
  | null {
  const [kind, translationId, bookId, chapterStr] = path;
  if (kind !== "meta" && kind !== "stream") return null;
  if (!translationId || !bookId || !chapterStr) return null;
  if (
    !/^[A-Za-z0-9_-]{1,15}$/.test(translationId) ||
    !/^[A-Za-z0-9]{1,8}$/.test(bookId)
  ) {
    return null;
  }
  const chapter = Number(chapterStr);
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > 150) return null;
  return { kind, translationId, bookId, chapter };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path } = await params;
  const parsed = parsePath(path);
  if (!parsed) return invalidReference();

  const { kind, translationId, bookId, chapter } = parsed;

  if (kind === "meta") {
    try {
      const meta = await audioService.getMeta(translationId, bookId, chapter);
      return NextResponse.json(meta);
    } catch {
      return NextResponse.json(
        { error: "Audio is temporarily unavailable. Try again shortly." },
        { status: 502 }
      );
    }
  }

  const resolved = await audioService.resolve(translationId, bookId, chapter);
  if (!resolved) {
    return NextResponse.json({ error: "Audio not found" }, { status: 404 });
  }

  try {
    const headers = new Headers();
    const range = req.headers.get("range");
    if (range) headers.set("Range", range);

    const upstream = await fetch(resolved.upstreamUrl, {
      headers,
      redirect: "follow",
    });

    if (upstream.status === 404) {
      return NextResponse.json({ error: "Audio not found" }, { status: 404 });
    }
    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        { error: "Audio is temporarily unavailable." },
        { status: 502 }
      );
    }

    const out = new Headers();
    for (const name of FORWARD_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) out.set(name, value);
    }
    if (!out.has("content-type")) out.set("content-type", "audio/mpeg");
    if (!out.has("accept-ranges")) out.set("accept-ranges", "bytes");
    out.set(
      "cache-control",
      out.get("cache-control") ?? "public, max-age=86400"
    );

    return new Response(upstream.body, {
      status: upstream.status,
      headers: out,
    });
  } catch {
    return NextResponse.json(
      { error: "Audio is temporarily unavailable." },
      { status: 502 }
    );
  }
}
