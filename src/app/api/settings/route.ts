import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/plans";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().max(100).optional(),
  timezone: z.string().max(64).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  translation: z.string().min(2).max(12).optional(),
  notification: z
    .object({
      enabled: z.boolean(),
      beforeMinutes: z.number().int().min(1).max(120),
      missedReminderEnabled: z.boolean(),
      missedAfterMinutes: z.number().int().min(5).max(240),
    })
    .optional(),
});

export async function GET() {
  try {
    const userId = await requireUserId();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        timezone: true,
        theme: true,
        notificationPrefs: true,
        readingPlans: {
          where: { status: "active" },
          select: { translation: true, sessionTimes: true, frequency: true },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });
    return NextResponse.json({ user });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const userId = await requireUserId();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
    }

    const data = parsed.data;
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
        ...(data.theme !== undefined ? { theme: data.theme } : {}),
      },
    });

    if (data.translation) {
      const plan = await prisma.readingPlan.findFirst({
        where: { userId, status: "active" },
        orderBy: { createdAt: "desc" },
      });
      if (plan) {
        await prisma.readingPlan.update({
          where: { id: plan.id },
          data: { translation: data.translation },
        });
      }
    }

    if (data.notification) {
      await prisma.notificationPreference.upsert({
        where: { userId },
        create: {
          userId,
          enabled: data.notification.enabled,
          beforeMinutes: data.notification.beforeMinutes,
          missedReminderEnabled: data.notification.missedReminderEnabled,
          missedAfterMinutes: data.notification.missedAfterMinutes,
        },
        update: {
          enabled: data.notification.enabled,
          beforeMinutes: data.notification.beforeMinutes,
          missedReminderEnabled: data.notification.missedReminderEnabled,
          missedAfterMinutes: data.notification.missedAfterMinutes,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Failed to update settings" }, { status: 400 });
  }
}
