import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { bibleService, BibleReferenceError } from "@/lib/bible/bibleService";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path } = await params;
  const [translationId, bookId, chapterStr] = path;

  if (!translationId || !bookId || !chapterStr) {
    return NextResponse.json({ error: "Invalid Bible path" }, { status: 400 });
  }

  const chapter = Number(chapterStr);
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > 150) {
    return NextResponse.json({ error: "Invalid chapter number" }, { status: 400 });
  }

  if (!/^[A-Za-z0-9-]{1,10}$/.test(translationId) || !/^[A-Za-z0-9]{1,8}$/.test(bookId)) {
    return NextResponse.json({ error: "Invalid reference" }, { status: 400 });
  }

  try {
    const result = await bibleService.getChapter(
      translationId.toUpperCase() === translationId || translationId.length <= 4
        ? translationId
        : translationId,
      bookId.toUpperCase(),
      chapter
    );
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof BibleReferenceError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Bible text is temporarily unavailable. Try again shortly." },
      { status: 502 }
    );
  }
}
