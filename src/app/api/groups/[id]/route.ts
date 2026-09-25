import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireGroupMember, getGroupById, getGroupMembers } from "@/lib/groups";
import { requireUserId } from "@/lib/plans";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const group = await getGroupById(id);
    await requireGroupMember(id, userId);

    const members = await getGroupMembers(id);
    const plans = await prisma.readingPlan.findMany({
      where: { groupId: id },
      select: { id: true, userId: true, status: true },
    });
    return NextResponse.json({
      group: {
        id: group.id,
        name: group.name,
        inviteCode: group.inviteCode,
        startDate: group.startDate,
        durationDays: group.durationDays,
        frequency: group.frequency,
        scheduledTimes: group.scheduledTimes,
        translation: group.translation,
      },
      members,
      plans,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Failed to load group" }, { status: 500 });
  }
}
