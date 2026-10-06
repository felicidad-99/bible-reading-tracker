import { NextResponse } from "next/server";
import { requireUserId, getActivePlan, todayDateString } from "@/lib/plans";
import { calculateStreaks } from "@/lib/plan/generator";
import { prisma } from "@/lib/prisma";

async function remindersPayload(userId: string) {
  const yesterday = new Date(Date.now() - 86400000)
    .toISOString()
    .slice(0, 10);

  const [user, nudges] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    }),
    prisma.nudge.findMany({
      where: { toUserId: userId, seenAt: null, date: { gte: yesterday } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        fromUser: { select: { name: true, email: true } },
        group: { select: { name: true } },
      },
    }),
  ]);

  const pendingNudges = nudges.map((n) => ({
    id: n.id,
    groupId: n.groupId,
    groupName: n.group.name,
    fromName: n.fromUser.name ?? n.fromUser.email.split("@")[0],
    date: n.date,
  }));

  const plan = await prisma.readingPlan.findFirst({
    where: { userId, status: "active" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!plan) return { stats: null, pendingNudges, sentReminders: {} };

  const today = todayDateString(user?.timezone);
  const [todayDay, next] = await Promise.all([
    prisma.readingDay.findFirst({
      where: { planId: plan.id, date: today },
      include: { sessions: { orderBy: { sessionNumber: "asc" } } },
    }),
    prisma.readingSession.findFirst({
      where: { status: { not: "completed" }, readingDay: { planId: plan.id } },
      orderBy: [{ readingDay: { date: "asc" } }, { sessionNumber: "asc" }],
      include: {
        readingDay: { select: { date: true, dayNumber: true } },
      },
    }),
  ]);

  const sessionIds = [
    ...(todayDay?.sessions.map((s) => s.id) ?? []),
    ...(next ? [next.id] : []),
  ];
  const sentRows = sessionIds.length
    ? await prisma.reminderSent.findMany({
        where: { userId, sessionId: { in: sessionIds } },
        select: { sessionId: true, kind: true },
      })
    : [];
  const sentReminders: Record<string, string[]> = {};
  for (const row of sentRows) {
    (sentReminders[row.sessionId] ??= []).push(row.kind);
  }

  return {
    pendingNudges,
    sentReminders,
    stats: {
      todayDay: todayDay ?? null,
      nextReading: next
        ? {
            sessionId: next.id,
            sessionNumber: next.sessionNumber,
            scheduledTime: next.scheduledTime,
            date: next.readingDay.date,
            dayNumber: next.readingDay.dayNumber,
            chapters: next.chapters,
            chapterCount: next.chapterCount,
            status: next.status,
          }
        : null,
    },
  };
}

export async function GET(req: Request) {
  try {
    const scope = new URL(req.url).searchParams.get("scope");
    const userId = await requireUserId();

    if (scope === "reminders") {
      return NextResponse.json(await remindersPayload(userId));
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true, name: true },
    });

    const plan = await getActivePlan(userId);
    if (!plan) {
      return NextResponse.json({ plan: null, stats: null });
    }

    const today = todayDateString(user?.timezone);
    const completedChapters = plan.progress.length;
    const planChapters = plan.days.reduce((sum, d) => sum + d.totalChapters, 0);
    const percent =
      planChapters > 0
        ? Math.round((completedChapters / planChapters) * 1000) / 10
        : 0;

    const completedDates = plan.days
      .filter((d) => d.status === "completed")
      .map((d) => d.date);
    const streaks = calculateStreaks(completedDates, today);

    const sessionsAll = plan.days.flatMap((d) => d.sessions);
    const sessionsCompleted = sessionsAll.filter(
      (s) => s.status === "completed"
    ).length;

    const start = new Date(plan.startDate + "T00:00:00");
    const end = new Date(plan.endDate + "T00:00:00");
    const now = today;
    const totalDays = plan.durationDays;
    const dayElapsed = Math.floor(
      (new Date(now + "T00:00:00").getTime() - start.getTime()) / 86400000
    );
    const currentDay = Math.min(Math.max(dayElapsed + 1, 1), totalDays);
    const daysRemaining = Math.max(
      Math.ceil((end.getTime() - new Date(now + "T00:00:00").getTime()) / 86400000),
      0
    );

    const todayDay = plan.days.find((d) => d.date === today);
    const missedDays = plan.days.filter(
      (d) => d.date < today && d.status === "missed"
    );
    const sessionsMissed = missedDays.reduce(
      (acc, d) => acc + d.sessions.filter((s) => s.status !== "completed").length,
      0
    );

    const nextReading = plan.days
      .flatMap((d) => d.sessions.map((s) => ({ ...s, date: d.date, dayNumber: d.dayNumber })))
      .filter((s) => s.status !== "completed")
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        return a.sessionNumber - b.sessionNumber;
      })[0];

    const todayUtc = new Date(now + "T00:00:00Z");
    const dow = (todayUtc.getUTCDay() + 6) % 7;
    const monday = new Date(todayUtc);
    monday.setUTCDate(monday.getUTCDate() - dow);
    const statusByDate = new Map(plan.days.map((d) => [d.date, d.status]));
    const week: Array<{ date: string; status: string }> = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setUTCDate(monday.getUTCDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const planStatus = statusByDate.get(iso);
      const status = !planStatus
        ? "none"
        : iso > now
          ? "upcoming"
          : iso === now
            ? planStatus === "completed"
              ? "completed"
              : "today"
            : planStatus;
      week.push({ date: iso, status });
    }
    const weekTarget = 5;
    const weekDone = week.slice(0, 5).filter((d) => d.status === "completed").length;

    return NextResponse.json({
      user: { name: user?.name ?? null },
      plan: {
        id: plan.id,
        status: plan.status,
        name: plan.name,
        durationDays: plan.durationDays,
        frequency: plan.frequency,
      },
      stats: {
        completedChapters,
        totalChapters: planChapters,
        percent,
        currentDay,
        totalDays,
        daysRemaining,
        currentStreak: streaks.currentStreak,
        longestStreak: streaks.longestStreak,
        sessionsCompleted,
        sessionsTotal: sessionsAll.length,
        sessionsMissed,
        remainingChapters: Math.max(planChapters - completedChapters, 0),
        finishDate: plan.endDate,
        todayDay: todayDay ?? null,
        missedCount: missedDays.length,
        week,
        weekTarget,
        weekDone,
        nextReading: nextReading
          ? {
              sessionId: nextReading.id,
              sessionNumber: nextReading.sessionNumber,
              scheduledTime: nextReading.scheduledTime,
              date: nextReading.date,
              dayNumber: nextReading.dayNumber,
              chapters: nextReading.chapters,
              chapterCount: nextReading.chapterCount,
              status: nextReading.status,
            }
          : null,
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
