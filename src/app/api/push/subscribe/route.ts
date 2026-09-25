import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/plans";
import { pushEnabled } from "@/lib/push/sendPush";

export async function GET() {
  return NextResponse.json({
    publicKey: process.env.VAPID_PUBLIC_KEY ?? null,
    configured: pushEnabled(),
  });
}

const subscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(256),
  }),
});

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    if (!pushEnabled()) {
      return NextResponse.json(
        { error: "Push notifications are not configured on this server" },
        { status: 503 }
      );
    }
    const body = await req.json();
    const parsed = subscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    const { endpoint, keys } = parsed.data;
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId, p256dh: keys.p256dh, auth: keys.auth },
      create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
  }
}

const unsubscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
});

export async function DELETE(req: Request) {
  try {
    const userId = await requireUserId();
    const body = await req.json();
    const parsed = unsubscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 });
    }
    await prisma.pushSubscription.deleteMany({
      where: { endpoint: parsed.data.endpoint, userId },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Failed to remove subscription" }, { status: 500 });
  }
}
