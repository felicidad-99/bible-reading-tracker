import { NextResponse } from "next/server";
import { requireUserId, getActivePlan, todayDateString } from "@/lib/plans";
import { prisma } from "@/lib/prisma";

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

    return NextResponse.json({ days, today, planId: plan.id });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Failed to load calendar" }, { status: 500 });
  }
}
