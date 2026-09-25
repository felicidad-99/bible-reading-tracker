import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireGroupMember,
  getGroupById,
  getGroupMembers,
  nextOwnerAfterLeave,
} from "@/lib/groups";
import { requireUserId } from "@/lib/plans";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const group = await getGroupById(id);
    const me = await requireGroupMember(id, userId);
    const members = await getGroupMembers(id);

    await prisma.readingPlan.updateMany({
      where: { userId, groupId: id },
      data: { groupId: null },
    });

    if (members.length <= 1) {
      await prisma.readingPlan.updateMany({
        where: { groupId: id },
        data: { groupId: null },
      });
      await prisma.group.delete({ where: { id } });
      return NextResponse.json({ left: true, groupId: null });
    }

    await prisma.groupMember.delete({
      where: { groupId_userId: { groupId: id, userId } },
    });

    if (me.role === "owner") {
      const nextOwnerId = nextOwnerAfterLeave(members, userId);
      if (nextOwnerId) {
        await prisma.groupMember.update({
          where: { groupId_userId: { groupId: id, userId: nextOwnerId } },
          data: { role: "owner" },
        });
      }
    }

    return NextResponse.json({ left: true, groupId: null, name: group.name });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Failed to leave group" }, { status: 400 });
  }
}
