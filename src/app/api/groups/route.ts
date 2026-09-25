import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createGroupSchema,
  groupPlanInput,
} from "@/lib/groups";
import { requireUserId, persistPlan } from "@/lib/plans";

export async function GET() {
  try {
    const userId = await requireUserId();
    const groups = await prisma.group.findMany({
      where: { members: { some: { userId } } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        inviteCode: true,
        startDate: true,
        durationDays: true,
        frequency: true,
        translation: true,
        createdAt: true,
        _count: { select: { members: true } },
      },
    });
    return NextResponse.json({ groups });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Failed to load groups" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const body = await req.json();
    const parsed = createGroupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid group input" },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const group = await prisma.group.create({
      data: {
        name: input.name,
        createdById: userId,
        startDate: input.startDate,
        durationDays: input.durationDays,
        frequency: input.frequency,
        scheduledTimes: input.scheduledTimes,
        translation: input.translation,
      },
    });

    await prisma.groupMember.create({
      data: { groupId: group.id, userId, role: "owner" },
    });

    try {
      const plan = await persistPlan(userId, groupPlanInput(group), group.id);
      return NextResponse.json({ group, plan }, { status: 201 });
    } catch (err) {
      await prisma.group
        .delete({ where: { id: group.id } })
        .catch(() => undefined);
      throw err;
    }
  } catch (err) {
    if (err instanceof Response) return err;
    const message = err instanceof Error ? err.message : "Failed to create group";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
