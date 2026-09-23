import { NextResponse } from "next/server";
import { requireUserId, getActivePlan, todayDateString } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { TOTAL_CHAPTERS } from "@/lib/plan/bible-books";
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
      return NextResponse.json({ stats: null });
    }

    const today = todayDateString(user?.timezone);
    const completedChapters = plan.progress.length;
    const percent = Math.round((completedChapters / TOTAL_CHAPTERS) * 1000) / 10;

    const completedDates = plan.days
      .filter((d) => d.status === "completed")
      .map((d) => d.date);
    const streaks = calculateStreaks(completedDates, today);

    const allSessions = plan.days.flatMap((d) => d.sessions);
    const sessionsCompleted = allSessions.filter(
      (s) => s.status === "completed"
    ).length;
    const sessionsMissed = plan.days
      .filter((d) => d.date < today)
      .flatMap((d) => d.sessions)
      .filter((s) => s.status !== "completed").length;

    const start = new Date(plan.startDate + "T00:00:00");
    const end = new Date(plan.endDate + "T00:00:00");
    const dayElapsed = Math.floor(
      (new Date(today + "T00:00:00").getTime() - start.getTime()) / 86400000
    );
    const currentDay = Math.min(Math.max(dayElapsed + 1, 1), plan.durationDays);
    const daysRemaining = Math.max(
      Math.ceil(
        (end.getTime() - new Date(today + "T00:00:00").getTime()) / 86400000
      ),
      0
    );

    const scheduledCompletion =
      completedChapters > 0 && dayElapsed > 0
        ? (() => {
            const rate = completedChapters / dayElapsed;
            const remaining = TOTAL_CHAPTERS - completedChapters;
            const daysNeeded = Math.ceil(remaining / rate);
            const est = new Date(today + "T00:00:00");
            est.setDate(est.getDate() + daysNeeded);
            return est.toISOString().slice(0, 10);
          })()
        : plan.endDate;

    return NextResponse.json({
      stats: {
        completedChapters,
        totalChapters: TOTAL_CHAPTERS,
        percent,
        currentStreak: streaks.currentStreak,
        longestStreak: streaks.longestStreak,
        sessionsCompleted,
        sessionsTotal: allSessions.length,
        sessionsMissed,
        currentDay,
        totalDays: plan.durationDays,
        daysRemaining,
        estimatedCompletion: scheduledCompletion,
        finishDate: plan.endDate,
        translation: plan.translation,
        frequency: plan.frequency,
        startDate: plan.startDate,
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
