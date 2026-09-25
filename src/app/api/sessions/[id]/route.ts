import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/plans";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    const session = await prisma.readingSession.findUnique({
      where: { id },
      include: {
        reads: true,
        readingDay: {
          select: {
            id: true,
            date: true,
            dayNumber: true,
            planId: true,
            plan: { select: { translation: true, userId: true } },
          },
        },
      },
    });

    if (!session || session.readingDay.plan.userId !== userId) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const { readingDay, reads, ...rest } = session;
    return NextResponse.json({
      session: {
        ...rest,
        readingDay: {
          id: readingDay.id,
          date: readingDay.date,
          dayNumber: readingDay.dayNumber,
          planId: readingDay.planId,
        },
      },
      translation: readingDay.plan.translation,
      reads: reads.map((r) => ({ bookId: r.bookId, chapter: r.chapter })),
    });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json(
      { error: "Failed to load session" },
      { status: 500 }
    );
  }
}
