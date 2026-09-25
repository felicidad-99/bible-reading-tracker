import { NextResponse } from "next/server";
import { z } from "zod";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireGroupMember, getGroupById } from "@/lib/groups";
import { requireUserId } from "@/lib/plans";
import { sendPushToUser, pushEnabled } from "@/lib/push/sendPush";

const nudgeSchema = z.object({
  toUserId: z.string().min(1).max(64),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const group = await getGroupById(id);
    await requireGroupMember(id, userId);

    const body = await req.json();
    const parsed = nudgeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid nudge" }, { status: 400 });
    }
    const { toUserId } = parsed.data;

    if (toUserId === userId) {
      return NextResponse.json(
        { error: "You cannot nudge yourself" },
        { status: 400 }
      );
    }

    const target = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: toUserId } },
      select: { userId: true },
    });
    if (!target) {
      return NextResponse.json(
        { error: "That member is not in this group" },
        { status: 404 }
      );
    }

    const today = format(new Date(), "yyyy-MM-dd");
    let nudgeId: string;
    try {
      const nudge = await prisma.nudge.create({
        data: { groupId: id, fromUserId: userId, toUserId, date: today },
      });
      nudgeId = nudge.id;
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") {
        return NextResponse.json(
          { error: "You already nudged them today." },
          { status: 409 }
        );
      }
      throw err;
    }

    const fromUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    const fromName =
      fromUser?.name ?? fromUser?.email.split("@")[0] ?? "A group member";

    let pushed = 0;
    if (pushEnabled()) {
      pushed = await sendPushToUser(toUserId, {
        title: `${fromName} nudged you`,
        body: `Open ${group.name} and get today's reading done.`,
        url: `/groups/${group.id}`,
      });
    }

    return NextResponse.json({ ok: true, nudgeId, pushed }, { status: 201 });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Failed to send nudge" }, { status: 500 });
  }
}
