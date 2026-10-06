import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/plans";

const claimSchema = z.object({
  sessionId: z.string().min(1).max(64),
  kind: z.enum(["before", "missed"]),
});

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const body = await req.json();
    const parsed = claimSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid claim" }, { status: 400 });
    }
    const { sessionId, kind } = parsed.data;
    const session = await prisma.readingSession.findFirst({
      where: { id: sessionId, readingDay: { plan: { userId } } },
      select: { id: true },
    });
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    const created = await prisma.reminderSent.createMany({
      data: [{ userId, sessionId, kind }],
      skipDuplicates: true,
    });
    return NextResponse.json({ ok: true, claimed: created.count > 0 });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Failed to claim reminder" }, { status: 500 });
  }
}
