import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  joinGroupSchema,
  evaluateJoin,
  JOIN_DECISION_MESSAGES,
  groupPlanInput,
  groupHasEnded,
} from "@/lib/groups";
import { requireUserId, persistPlan } from "@/lib/plans";

export async function GET(req: Request) {
  try {
    const userId = await requireUserId();
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code")?.trim();
    if (!code) {
      return NextResponse.json({ error: "Missing invite code" }, { status: 400 });
    }

    const group = await prisma.group.findUnique({
      where: { inviteCode: code },
      select: {
        id: true,
        name: true,
        startDate: true,
        durationDays: true,
        frequency: true,
        scheduledTimes: true,
        translation: true,
      },
    });
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const [memberCount, membership] = await Promise.all([
      prisma.groupMember.count({ where: { groupId: group.id } }),
      prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId: group.id, userId } },
        select: { id: true },
      }),
    ]);

    const isMember = membership !== null;
    const ended = groupHasEnded(group, new Date());
    const decision = evaluateJoin(memberCount, isMember);
    const canJoin = decision === "ok" && !ended;

    return NextResponse.json({
      group,
      memberCount,
      isMember,
      canJoin,
      reason: ended
        ? "This group's reading plan has already finished."
        : JOIN_DECISION_MESSAGES[decision] || null,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Failed to load group" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const body = await req.json();
    const parsed = joinGroupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid invite code" },
        { status: 400 }
      );
    }

    const group = await prisma.group.findUnique({
      where: { inviteCode: parsed.data.inviteCode },
    });
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const [memberCount, membership] = await Promise.all([
      prisma.groupMember.count({ where: { groupId: group.id } }),
      prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId: group.id, userId } },
        select: { id: true },
      }),
    ]);

    const decision = evaluateJoin(memberCount, membership !== null);
    if (decision !== "ok") {
      return NextResponse.json(
        { error: JOIN_DECISION_MESSAGES[decision] },
        { status: 409 }
      );
    }
    if (groupHasEnded(group, new Date())) {
      return NextResponse.json(
        { error: "This group's reading plan has already finished." },
        { status: 409 }
      );
    }

    try {
      await prisma.groupMember.create({
        data: { groupId: group.id, userId, role: "member" },
      });
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") {
        return NextResponse.json(
          { error: "You are already a member of this group." },
          { status: 409 }
        );
      }
      throw err;
    }

    try {
      const plan = await persistPlan(userId, groupPlanInput(group), group.id);
      return NextResponse.json({ groupId: group.id, plan }, { status: 201 });
    } catch (err) {
      await prisma.groupMember
        .delete({
          where: { groupId_userId: { groupId: group.id, userId } },
        })
        .catch(() => undefined);
      throw err;
    }
  } catch (err) {
    if (err instanceof Response) return err;
    const message = err instanceof Error ? err.message : "Failed to join group";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
