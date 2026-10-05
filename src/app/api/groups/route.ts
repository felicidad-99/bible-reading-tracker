import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createGroupSchema,
  groupPlanInput,
} from "@/lib/groups";
import {
  requireUserId,
  persistPlan,
  todayDateString,
} from "@/lib/plans";
import {
  calculateStreaks,
  formatChapterRange,
  type ChapterRange,
} from "@/lib/plan/generator";

export async function GET() {
  try {
    const userId = await requireUserId();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
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
        scheduledTimes: true,
        _count: { select: { members: true } },
        members: {
          select: { user: { select: { name: true, email: true } } },
          take: 3,
        },
      },
    });

    const groupIds = groups.map((g) => g.id);
    if (groupIds.length === 0) {
      return NextResponse.json({ groups: [], week: null });
    }

    const today = todayDateString(user?.timezone);
    const todayUtc = new Date(today + "T00:00:00Z");
    const dow = (todayUtc.getUTCDay() + 6) % 7;
    const monday = new Date(todayUtc);
    monday.setUTCDate(monday.getUTCDate() - dow);
    const weekStart = monday.toISOString().slice(0, 10);

    const [groupPlans, weekDays, myCompleted] = await Promise.all([
      prisma.readingPlan.findMany({
        where: { groupId: { in: groupIds }, status: "active" },
        select: {
          id: true,
          userId: true,
          groupId: true,
          days: {
            where: { date: today },
            orderBy: { dayNumber: "asc" },
            select: {
              status: true,
              sessions: {
                orderBy: { sessionNumber: "asc" },
                select: { status: true, chapters: true },
              },
            },
          },
        },
      }),
      prisma.readingDay.findMany({
        where: {
          plan: { groupId: { in: groupIds }, status: "active" },
          date: { gte: weekStart, lte: today },
        },
        select: {
          planId: true,
          date: true,
          status: true,
          completedChapters: true,
          totalChapters: true,
        },
      }),
      prisma.readingDay.findMany({
        where: {
          plan: { userId, groupId: { in: groupIds }, status: "active" },
          status: "completed",
        },
        select: { date: true, plan: { select: { groupId: true } } },
      }),
    ]);

    const plansByGroup = new Map<string, typeof groupPlans>();
    for (const p of groupPlans) {
      const list = plansByGroup.get(p.groupId ?? "");
      if (list) list.push(p);
      else plansByGroup.set(p.groupId ?? "", [p]);
    }
    const myDatesByGroup = new Map<string, string[]>();
    for (const d of myCompleted) {
      const gid = d.plan.groupId;
      if (!gid) continue;
      const list = myDatesByGroup.get(gid);
      if (list) list.push(d.date);
      else myDatesByGroup.set(gid, [d.date]);
    }

    const enriched = groups.map((g) => {
      const plans = plansByGroup.get(g.id) ?? [];
      const mine = plans.find((p) => p.userId === userId);
      const myToday = mine?.days[0] ?? null;
      const readyToday = plans.filter((p) => p.days[0]?.status === "completed")
        .length;
      const streaks = calculateStreaks(myDatesByGroup.get(g.id) ?? [], today);
      const todayReading = myToday
        ? myToday.sessions
            .flatMap((s) => s.chapters as unknown as ChapterRange[])
            .map(formatChapterRange)
            .join(" & ")
        : null;
      return {
        ...g,
        myStreak: streaks.currentStreak,
        readyToday,
        iCompletedToday: myToday?.status === "completed",
        todayReading,
      };
    });

    const weekCompleted = weekDays.reduce((s, d) => s + d.completedChapters, 0);
    const weekExpected = weekDays.reduce((s, d) => s + d.totalChapters, 0);
    const finishedToday = new Set(
      weekDays
        .filter((d) => d.date === today && d.status === "completed")
        .map((d) => d.planId)
    ).size;
    const week = {
      completed: weekCompleted,
      expected: weekExpected,
      percent:
        weekExpected > 0
          ? Math.round((weekCompleted / weekExpected) * 100)
          : 0,
      finishedToday,
    };

    return NextResponse.json({ groups: enriched, week });
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
