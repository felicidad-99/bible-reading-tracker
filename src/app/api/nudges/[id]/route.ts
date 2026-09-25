import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/plans";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const result = await prisma.nudge.updateMany({
      where: { id, toUserId: userId },
      data: { seenAt: new Date() },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Nudge not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Failed to update nudge" }, { status: 500 });
  }
}
