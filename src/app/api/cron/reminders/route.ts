import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pushEnabled, sendPushToUser } from "@/lib/push/sendPush";
import {
  reminderDue,
  formatChapters,
  sessionLabel,
  localDateKey,
  previousDateKey,
} from "@/lib/reminder-window";

export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!pushEnabled()) {
    return NextResponse.json({ ok: true, skipped: "push-unconfigured" });
  }

  const now = new Date();
  const users = await prisma.user.findMany({
    where: {
      pushSubscriptions: { some: {} },
      notificationPrefs: {
        is: { OR: [{ enabled: true }, { missedReminderEnabled: true }] },
      },
      readingPlans: { some: { status: "active" } },
    },
    select: {
      id: true,
      timezone: true,
      notificationPrefs: true,
    },
  });

  let evaluated = 0;
  let sent = 0;

  for (const user of users) {
    const prefs = user.notificationPrefs;
    if (!prefs) continue;

    const today = localDateKey(now, user.timezone);
    const yesterday = previousDateKey(today);

    const sessions = await prisma.readingSession.findMany({
      where: {
        status: { not: "completed" },
        readingDay: {
          date: { in: [today, yesterday] },
          plan: { userId: user.id, status: "active" },
        },
      },
      select: {
        id: true,
        sessionNumber: true,
        scheduledTime: true,
        chapters: true,
        readingDay: { select: { date: true } },
      },
      take: 6,
    });
    if (sessions.length === 0) continue;

    const sentRows = await prisma.reminderSent.findMany({
      where: { userId: user.id, sessionId: { in: sessions.map((s) => s.id) } },
      select: { sessionId: true, kind: true },
    });
    const sentKinds = new Map<string, Set<string>>();
    for (const row of sentRows) {
      const set = sentKinds.get(row.sessionId) ?? new Set<string>();
      set.add(row.kind);
      sentKinds.set(row.sessionId, set);
    }

    for (const s of sessions) {
      evaluated++;
      const kinds = sentKinds.get(s.id) ?? new Set<string>();
      const due = reminderDue({
        session: {
          sessionId: s.id,
          scheduledDate: s.readingDay.date,
          scheduledTime: s.scheduledTime,
          completed: false,
        },
        prefs,
        now,
        timezone: user.timezone,
        sentBefore: kinds.has("before"),
        sentMissed: kinds.has("missed"),
      });
      if (!due) continue;

      const reading = formatChapters(s.chapters);
      const payload =
        due.kind === "before"
          ? {
              title: "Reading coming up",
              body: `Your Bible reading is scheduled in ${due.minutesUntil} minutes. Today's reading: ${reading}.`,
              url: "/dashboard",
              tag: "bible-reminder",
            }
          : {
              title: "Missed reading",
              body: `You missed your ${sessionLabel(
                s.sessionNumber
              )} Bible reading. You still have ${reading} remaining today.`,
              url: "/dashboard",
              tag: "bible-reminder",
            };

      const delivered = await sendPushToUser(user.id, payload);
      if (delivered > 0) {
        sent += delivered;
        await prisma.reminderSent
          .createMany({
            data: [
              { userId: user.id, sessionId: s.id, kind: due.kind },
            ],
            skipDuplicates: true,
          })
          .catch(() => undefined);
      }
    }
  }

  return NextResponse.json({ ok: true, users: users.length, evaluated, sent });
}
