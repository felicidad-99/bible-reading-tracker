import { NextResponse } from "next/server";
import { z } from "zod";
import { sendPasswordReset } from "@/lib/auth";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    await sendPasswordReset(parsed.data.email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not send reset email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
