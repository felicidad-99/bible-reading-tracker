import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { BIBLE_BOOKS } from "@/lib/plan/bible-books";

const startSchema = z.object({
  sessionId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const body = await req.json();
    const parsed = startSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid session" }, { status: 400 });
    }

    const session = await prisma.readingSession.findUnique({
      where: { id: parsed.data.sessionId },
      include: { readingDay: { include: { plan: true } } },
    });

    if (!session || session.readingDay.plan.userId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (session.status === "not_started") {
      await prisma.readingSession.update({
        where: { id: session.id },
        data: { status: "in_progress", startedAt: new Date() },
      });
    }

    return NextResponse.json({ ok: true, sessionId: session.id });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Failed to start session" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const userId = await requireUserId();
    const body = await req.json();

    const patchSchema = z.object({
      sessionId: z.string().min(1),
      bookId: z.string(),
      chapter: z.number().int().min(1),
      read: z.boolean().optional(),
      complete: z.boolean().optional(),
    });

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { sessionId, bookId, chapter, read, complete } = parsed.data;

    const session = await prisma.readingSession.findUnique({
      where: { id: sessionId },
      include: {
        readingDay: { include: { plan: true } },
        reads: true,
      },
    });

    if (!session || session.readingDay.plan.userId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const validBook = BIBLE_BOOKS.find((b) => b.id === bookId);
    if (!validBook || chapter < 1 || chapter > validBook.chapters) {
      return NextResponse.json({ error: "Invalid Bible reference" }, { status: 400 });
    }

    if (read) {
      await prisma.sessionReadChapter.upsert({
        where: {
          sessionId_bookId_chapter: { sessionId, bookId, chapter },
        },
        create: { sessionId, bookId, chapter },
        update: { readAt: new Date() },
      });

      if (session.status === "not_started") {
        await prisma.readingSession.update({
          where: { id: sessionId },
          data: { status: "in_progress", startedAt: session.startedAt ?? new Date() },
        });
      }
    }

    if (complete) {
      await prisma.readingSession.update({
        where: { id: sessionId },
        data: { status: "completed", completedAt: new Date() },
      });

      const chapters = session.chapters as Array<{
        bookId: string;
        start: number;
        end: number;
      }>;

      const planId = session.readingDay.planId;
      for (const range of chapters) {
        for (let ch = range.start; ch <= range.end; ch++) {
          await prisma.readingProgress.upsert({
            where: {
              planId_bookId_chapter: { planId, bookId: range.bookId, chapter: ch },
            },
            create: {
              userId,
              planId,
              bookId: range.bookId,
              chapter: ch,
            },
            update: {},
          });
        }
      }

      const allSessions = await prisma.readingSession.findMany({
        where: { readingDayId: session.readingDayId },
      });
      const progressCount = await prisma.readingProgress.count({
        where: { planId },
      });

      const allDone = allSessions.every((s) => s.status === "completed");
      await prisma.readingDay.update({
        where: { id: session.readingDayId },
        data: {
          status: allDone ? "completed" : "in_progress",
          completedChapters: Math.min(
            progressCount,
            session.readingDay.totalChapters
          ),
        },
      });
    }

    const fresh = await prisma.readingSession.findUnique({
      where: { id: sessionId },
      include: { reads: true },
    });

    return NextResponse.json({ ok: true, session: fresh });
  } catch (err) {
    if (err instanceof Response) return err;
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
