import { NextResponse } from "next/server";
import { requireUserId, getActivePlan, todayDateString } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { calculateStreaks } from "@/lib/plan/generator";

export async function GET() {
  try {
    const userId = await requireUserId();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    const plan = await getActivePlan(userId);
    if (!plan) {
      return NextResponse.json({ days: [], today: todayDateString(user?.timezone) });
    }

    const today = todayDateString(user?.timezone);
    const completedDates = plan.days
      .filter((d) => d.status === "completed")
      .map((d) => d.date);
    const streaks = calculateStreaks(completedDates, today);
    const planChapters = plan.days.reduce((sum, d) => sum + d.totalChapters, 0);
    const percent =
      planChapters > 0
        ? Math.round((plan.progress.length / planChapters) * 1000) / 10
        : 0;
    const days = plan.days.map((d) => ({
      id: d.id,
      date: d.date,
      dayNumber: d.dayNumber,
      status: d.date < today && d.status !== "completed"
        ? d.sessions.every((s) => s.status === "completed")
          ? "completed"
          : d.sessions.some((s) => s.status === "completed")
            ? "missed"
            : "missed"
        : d.status,
      totalChapters: d.totalChapters,
      completedChapters: d.completedChapters,
      isToday: d.date === today,
      sessions: d.sessions.map((s) => ({
        id: s.id,
        sessionNumber: s.sessionNumber,
        scheduledTime: s.scheduledTime,
        status: s.status,
        chapterCount: s.chapterCount,
        chapters: s.chapters,
      })),
    }));

    return NextResponse.json({
      days,
      today,
      planId: plan.id,
      plan: {
        name: plan.name,
        durationDays: plan.durationDays,
        frequency: plan.frequency,
      },
      percent,
      currentStreak: streaks.currentStreak,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Failed to load calendar" }, { status: 500 });
  }
}
