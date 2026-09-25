import { NextResponse } from "next/server";
import { format, addDays, parseISO } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireGroupMember, getGroupById, getGroupMembers } from "@/lib/groups";
import { requireUserId } from "@/lib/plans";
import { computeDayStatus, calculateStreaks } from "@/lib/plan/generator";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const group = await getGroupById(id);
    await requireGroupMember(id, userId);

    const { searchParams } = new URL(req.url);
    const startParam = searchParams.get("start");
    const start = startParam && DATE_RE.test(startParam)
      ? startParam
      : format(new Date(), "yyyy-MM-dd");
    const dates = Array.from({ length: 7 }, (_, i) =>
      format(addDays(parseISO(start), i), "yyyy-MM-dd")
    );

    const now = new Date();
    const members = await getGroupMembers(id);
    const plans = await prisma.readingPlan.findMany({
      where: { groupId: id, status: "active" },
      select: { id: true, userId: true },
    });
    const planIds = plans.map((p) => p.id);
    const planByUser = new Map(plans.map((p) => [p.userId, p.id]));

    const [windowDays, completedDays] = await Promise.all([
      prisma.readingDay.findMany({
        where: {
          planId: { in: planIds },
          date: { in: dates },
        },
        select: {
          planId: true,
          date: true,
          dayNumber: true,
          sessions: { select: { status: true, scheduledTime: true } },
        },
      }),
      planIds.length > 0
        ? prisma.readingDay.findMany({
            where: { planId: { in: planIds }, status: "completed" },
            select: { planId: true, date: true },
          })
        : [],
    ]);

    const dayMap = new Map(windowDays.map((d) => [`${d.planId}|${d.date}`, d]));
    const completedByPlan = new Map<string, string[]>();
    for (const d of completedDays) {
      const list = completedByPlan.get(d.planId);
      if (list) list.push(d.date);
      else completedByPlan.set(d.planId, [d.date]);
    }

    const rows = members.map((m) => {
      const planId = planByUser.get(m.userId) ?? null;
      const streaks = planId
        ? calculateStreaks(completedByPlan.get(planId) ?? [], format(now, "yyyy-MM-dd"))
        : { currentStreak: 0, longestStreak: 0 };

      const cells = dates.map((date) => {
        if (!planId) return { date, dayNumber: null, status: "no_plan" };
        const day = dayMap.get(`${planId}|${date}`);
        if (!day) return { date, dayNumber: null, status: "no_day" };
        const status = computeDayStatus(
          {
            date,
            sessions: day.sessions.map((s) => ({
              completed: s.status === "completed",
              scheduledTime: s.scheduledTime,
            })),
          },
          now
        );
        return { date, dayNumber: day.dayNumber, status };
      });

      return {
        userId: m.userId,
        name: m.user.name ?? m.user.email.split("@")[0],
        image: m.user.image,
        role: m.role,
        planId,
        currentStreak: streaks.currentStreak,
        longestStreak: streaks.longestStreak,
        cells,
      };
    });

    const today = format(now, "yyyy-MM-dd");
    const sentToday = await prisma.nudge.findMany({
      where: { groupId: id, fromUserId: userId, date: today },
      select: { toUserId: true },
    });

    return NextResponse.json({
      group: {
        id: group.id,
        name: group.name,
        startDate: group.startDate,
        durationDays: group.durationDays,
        frequency: group.frequency,
        scheduledTimes: group.scheduledTimes,
        translation: group.translation,
      },
      start,
      dates,
      meUserId: userId,
      nudgedToday: sentToday.map((n) => n.toUserId),
      members: rows,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Failed to load matrix" }, { status: 500 });
  }
}
