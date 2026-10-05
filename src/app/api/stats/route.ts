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
      return NextResponse.json({ stats: null });
    }

    const today = todayDateString(user?.timezone);
    const completedChapters = plan.progress.length;
    const planChapters = plan.days.reduce((sum, d) => sum + d.totalChapters, 0);
    const percent = planChapters > 0 ? Math.round((completedChapters / planChapters) * 1000) / 10 : 0;

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
            const remaining = planChapters - completedChapters;
            const daysNeeded = Math.ceil(remaining / rate);
            const est = new Date(today + "T00:00:00");
            est.setDate(est.getDate() + daysNeeded);
            return est.toISOString().slice(0, 10);
          })()
        : plan.endDate;

    const progressByDate = new Map<string, number>();
    for (const p of plan.progress) {
      const iso = p.completedAt.toISOString().slice(0, 10);
      progressByDate.set(iso, (progressByDate.get(iso) ?? 0) + 1);
    }

    const todayUtc = new Date(today + "T00:00:00Z");
    const dow = (todayUtc.getUTCDay() + 6) % 7;
    const monday = new Date(todayUtc);
    monday.setUTCDate(monday.getUTCDate() - dow);
    const dayByDate = new Map(plan.days.map((d) => [d.date, d]));
    const week: Array<{
      date: string;
      chapters: number;
      completed: boolean;
      isToday: boolean;
    }> = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setUTCDate(monday.getUTCDate() + i);
      const iso = d.toISOString().slice(0, 10);
      week.push({
        date: iso,
        chapters: progressByDate.get(iso) ?? 0,
        completed: dayByDate.get(iso)?.status === "completed",
        isToday: iso === today,
      });
    }
    const weekChapters = week.reduce((sum, d) => sum + d.chapters, 0);
    const weekDone = week.filter((d) => d.completed).length;

    const sessionCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    const sessionTimes: Record<number, string> = {};
    for (const day of plan.days) {
      for (const s of day.sessions) {
        if (s.status === "completed") {
          sessionCounts[s.sessionNumber] =
            (sessionCounts[s.sessionNumber] ?? 0) + 1;
          if (!sessionTimes[s.sessionNumber]) {
            sessionTimes[s.sessionNumber] = s.scheduledTime;
          }
        }
      }
    }
    const favNum = Number(
      Object.keys(sessionCounts).reduce(
        (best, key) =>
          (sessionCounts[Number(key)] ?? 0) > (sessionCounts[best] ?? 0)
            ? Number(key)
            : best,
        1
      )
    );
    const favourite =
      sessionCounts[favNum] > 0
        ? {
            label:
              favNum === 1 ? "Morning" : favNum === 2 ? "Afternoon" : "Evening",
            time: sessionTimes[favNum] ?? null,
          }
        : null;

    const avgSessionChapters =
      sessionsCompleted > 0
        ? Math.round((completedChapters / sessionsCompleted) * 10) / 10
        : 0;

    const bookCounts = new Map<string, number>();
    for (const p of plan.progress) {
      bookCounts.set(p.bookId, (bookCounts.get(p.bookId) ?? 0) + 1);
    }
    let topBook: { id: string; chapters: number } | null = null;
    for (const [id, count] of bookCounts) {
      if (!topBook || count > topBook.chapters) topBook = { id, chapters: count };
    }

    return NextResponse.json({
      stats: {
        completedChapters,
        totalChapters: planChapters,
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
        week,
        weekChapters,
        weekDone,
        favourite,
        avgSessionChapters,
        topBook,
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
