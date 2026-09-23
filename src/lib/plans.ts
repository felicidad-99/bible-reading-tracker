import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { generateReadingPlan, type Frequency } from "@/lib/plan/generator";

export type PlanWithRelations = Prisma.ReadingPlanGetPayload<{
  include: {
    days: {
      include: {
        sessions: true;
      };
    };
    progress: true;
  };
}> & {
  notificationPrefs: {
    id: string;
    userId: string;
    enabled: boolean;
    beforeMinutes: number;
    missedReminderEnabled: boolean;
    missedAfterMinutes: number;
    maxMissedPerSession: number;
  } | null;
};

export async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return userId;
}

export const createPlanSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationDays: z.number().int().min(1).max(3650),
  frequency: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  translation: z.string().min(2).max(12),
  sessionTimes: z.array(z.string().regex(/^\d{2}:\d{2}$/)).min(1).max(3),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;

export async function getActivePlan(
  userId: string
): Promise<PlanWithRelations | null> {
  const plan = await prisma.readingPlan.findFirst({
    where: { userId, status: "active" },
    orderBy: { createdAt: "desc" },
    include: {
      days: {
        orderBy: { dayNumber: "asc" },
        include: {
          sessions: { orderBy: { sessionNumber: "asc" } },
        },
      },
      progress: {
        orderBy: { completedAt: "asc" },
      },
    },
  });

  if (!plan) return null;

  const notificationPrefs = await prisma.notificationPreference.findUnique({
    where: { userId },
  });

  return { ...plan, notificationPrefs };
}

export async function persistPlan(userId: string, input: CreatePlanInput) {
  const generated = generateReadingPlan({
    startDate: input.startDate,
    durationDays: input.durationDays,
    frequency: input.frequency as Frequency,
  });

  const existingActive = await prisma.readingPlan.findFirst({
    where: { userId, status: "active" },
  });
  if (existingActive) {
    await prisma.readingPlan.update({
      where: { id: existingActive.id },
      data: { status: "archived" },
    });
  }

  const plan = await prisma.readingPlan.create({
    data: {
      userId,
      startDate: generated.startDate,
      endDate: generated.endDate,
      durationDays: generated.durationDays,
      frequency: generated.frequency,
      translation: input.translation,
      sessionTimes: input.sessionTimes,
      status: "active",
      days: {
        create: generated.days.map((day) => ({
          date: day.date,
          dayNumber: day.dayNumber,
          status: "not_started",
          totalChapters: day.totalChapters,
          completedChapters: 0,
          sessions: {
            create: day.sessions.map((session) => {
              const withTimes = day.sessions.map((s, i) => ({
                ...s,
                scheduledTime: input.sessionTimes[i] ?? s.scheduledTime,
              }));
              const timed = withTimes[session.sessionNumber - 1] ?? session;
              return {
                sessionNumber: timed.sessionNumber,
                scheduledTime: timed.scheduledTime,
                status: "not_started",
                chapters: timed.chapters as unknown as Prisma.InputJsonValue,
                chapterCount: timed.chapterCount,
              };
            }),
          },
        })),
      },
    },
    include: {
      days: {
        orderBy: { dayNumber: "asc" },
        include: { sessions: { orderBy: { sessionNumber: "asc" } } },
      },
      progress: true,
    },
  });

  const notificationPrefs = await prisma.notificationPreference.findUnique({
    where: { userId },
  });

  return { ...plan, notificationPrefs };
}

export function todayDateString(timezone?: string): string {
  const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}
