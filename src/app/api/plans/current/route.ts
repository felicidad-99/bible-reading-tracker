import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { requireUserId, getActivePlan } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { generateReadingPlan, type Frequency, catchUpRedistribute, type PlanSession } from "@/lib/plan/generator";

const updateSchema = z.object({
  action: z.enum(["pause", "resume", "update_end", "update_frequency", "regenerate", "catch_up"]),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  frequency: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  sessionTimes: z.array(z.string().regex(/^\d{2}:\d{2}$/)).min(1).max(3).optional(),
  translation: z.string().min(2).max(12).optional(),
});

export async function PATCH(req: Request) {
  try {
    const userId = await requireUserId();
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid update" }, { status: 400 });
    }

    const plan = await getActivePlan(userId);
    if (!plan) {
      return NextResponse.json({ error: "No active plan" }, { status: 404 });
    }

    const { action } = parsed.data;

    if (action === "pause") {
      await prisma.readingPlan.update({
        where: { id: plan.id },
        data: { status: "paused" },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "resume") {
      await prisma.readingPlan.update({
        where: { id: plan.id },
        data: { status: "active" },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "update_end") {
      if (!parsed.data.endDate) {
        return NextResponse.json({ error: "endDate required" }, { status: 400 });
      }
      const start = new Date(plan.startDate + "T00:00:00");
      const end = new Date(parsed.data.endDate + "T00:00:00");
      const durationDays =
        Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
      if (durationDays < 1) {
        return NextResponse.json(
          { error: "End date must be after start date" },
          { status: 400 }
        );
      }

      await regeneratePlan(plan.id, userId, {
        startDate: plan.startDate,
        durationDays,
        frequency: plan.frequency as Frequency,
      }, parsed.data.sessionTimes);

      await prisma.readingPlan.update({
        where: { id: plan.id },
        data: {
          endDate: parsed.data.endDate,
          durationDays,
          ...(parsed.data.sessionTimes
            ? { sessionTimes: parsed.data.sessionTimes }
            : {}),
        },
      });

      return NextResponse.json({ ok: true, durationDays });
    }

    if (action === "update_frequency") {
      if (!parsed.data.frequency) {
        return NextResponse.json({ error: "frequency required" }, { status: 400 });
      }
      const start = new Date(plan.startDate + "T00:00:00");
      const end = new Date(plan.endDate + "T00:00:00");
      const durationDays =
        Math.round((end.getTime() - start.getTime()) / 86400000) + 1;

      await regeneratePlan(
        plan.id,
        userId,
        {
          startDate: plan.startDate,
          durationDays,
          frequency: parsed.data.frequency,
        },
        parsed.data.sessionTimes
      );

      await prisma.readingPlan.update({
        where: { id: plan.id },
        data: {
          frequency: parsed.data.frequency,
          ...(parsed.data.sessionTimes
            ? { sessionTimes: parsed.data.sessionTimes }
            : {}),
        },
      });

      return NextResponse.json({ ok: true });
    }

    if (action === "regenerate") {
      const start = new Date(plan.startDate + "T00:00:00");
      const end = new Date(plan.endDate + "T00:00:00");
      const durationDays =
        Math.round((end.getTime() - start.getTime()) / 86400000) + 1;

      await regeneratePlan(
        plan.id,
        userId,
        {
          startDate: plan.startDate,
          durationDays,
          frequency: plan.frequency as Frequency,
        },
        parsed.data.sessionTimes
      );
      return NextResponse.json({ ok: true });
    }

    if (action === "catch_up") {
      const today = new Date().toISOString().slice(0, 10);
      const completedSet = new Set(
        plan.progress.map((p) => `${p.bookId}:${p.chapter}`)
      );

      const pastIncomplete = plan.days.filter(
        (d: { date: string; status: string }) =>
          d.date < today && d.status !== "completed"
      );

      const remaining = plan.days.filter(
        (d: { date: string; status: string }) =>
          d.date >= today && d.status !== "completed"
      );

      let missedChapters = 0;
      for (const day of pastIncomplete) {
        for (const session of day.sessions) {
          if (session.status === "completed") continue;
          const chapters = session.chapters as unknown as Array<{
            bookId: string;
            start: number;
            end: number;
          }>;
          for (const range of chapters) {
            for (let ch = range.start; ch <= range.end; ch++) {
              if (!completedSet.has(`${range.bookId}:${ch}`)) {
                missedChapters++;
              }
            }
          }
        }
      }

      if (missedChapters === 0 || remaining.length === 0) {
        return NextResponse.json({
          ok: true,
          addedChapters: 0,
          message: "Nothing to catch up",
        });
      }

      const remainingDayPayload = remaining.map(
        (d: {
          dayNumber: number;
          date: string;
          status: string;
          totalChapters: number;
          sessions: unknown[];
        }) => ({
          dayNumber: d.dayNumber,
          date: d.date,
          status: d.status,
          totalChapters: d.totalChapters,
          sessions: d.sessions as PlanSession[],
        })
      );

      const { days: caughtUp, addedPerDay } = catchUpRedistribute(
        missedChapters,
        remainingDayPayload.map((d) => ({
          ...d,
          sessions: d.sessions.map((s) => ({
            ...s,
            chapters: (s as PlanSession).chapters ?? [],
            chapterCount:
              (s as PlanSession).chapterCount ??
              ((s as { chapters?: unknown }).chapters as unknown[])?.length ??
              0,
          })),
        }))
      );

      for (let i = 0; i < remaining.length; i++) {
        const target = remaining[i];
        const updated = caughtUp[i];
        if (!updated) continue;

        await prisma.readingDay.update({
          where: { id: target.id },
          data: {
            totalChapters: updated.totalChapters,
            sessions: {
              deleteMany: {},
              create: updated.sessions.map((s) => ({
                sessionNumber: s.sessionNumber,
                scheduledTime: s.scheduledTime,
                status: "not_started",
                chapters: s.chapters as unknown as Prisma.InputJsonValue,
                chapterCount: s.chapterCount,
              })),
            },
          },
        });
      }

      return NextResponse.json({
        ok: true,
        addedChapters: missedChapters,
        addedPerDay,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    if (err instanceof Response) return err;
    const message = err instanceof Error ? err.message : "Failed to update plan";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

async function regeneratePlan(
  planId: string,
  userId: string,
  input: {
    startDate: string;
    durationDays: number;
    frequency: Frequency;
  },
  sessionTimes?: string[]
) {
  const fresh = generateReadingPlan(input);
  const completedDays = await prisma.readingDay.findMany({
    where: { planId, status: "completed" },
    orderBy: { dayNumber: "asc" },
    include: { sessions: { orderBy: { sessionNumber: "asc" } } },
  });
  const completedByDay = new Map(completedDays.map((d) => [d.dayNumber, d]));

  await prisma.readingDay.deleteMany({ where: { planId, status: { not: "completed" } } });

  for (const day of fresh.days) {
    if (completedByDay.has(day.dayNumber)) continue;

    await prisma.readingDay.create({
      data: {
        planId,
        date: day.date,
        dayNumber: day.dayNumber,
        status: "not_started",
        totalChapters: day.totalChapters,
        completedChapters: 0,
        sessions: {
          create: day.sessions.map((s, i) => ({
            sessionNumber: s.sessionNumber,
            scheduledTime: sessionTimes?.[i] ?? s.scheduledTime,
            status: "not_started",
            chapters: s.chapters as unknown as Prisma.InputJsonValue,
            chapterCount: s.chapterCount,
          })),
        },
      },
    });
  }
}
