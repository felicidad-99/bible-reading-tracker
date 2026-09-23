import { NextResponse } from "next/server";
import { z } from "zod";
import { createUser } from "@/lib/auth";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  name: z.string().max(100).optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const user = await createUser({
      email: parsed.data.email,
      name: parsed.data.name,
      password: parsed.data.password,
    });

    return NextResponse.json({
      ok: true,
      userId: user.id,
      email: user.email,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not create account";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
