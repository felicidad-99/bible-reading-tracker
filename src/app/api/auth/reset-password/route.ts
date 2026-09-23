import { NextResponse } from "next/server";
import { z } from "zod";
import { resetPassword } from "@/lib/auth";

const schema = z.object({
  token: z.string().min(10),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    await resetPassword(parsed.data.token, parsed.data.password);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not reset password";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
