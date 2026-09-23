import { NextResponse } from "next/server";
import { requireUserId, createPlanSchema, persistPlan, getActivePlan } from "@/lib/plans";

export async function GET() {
  try {
    const userId = await requireUserId();
    const plan = await getActivePlan(userId);
    return NextResponse.json({ plan });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Failed to load plan" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const body = await req.json();
    const parsed = createPlanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid plan input" },
        { status: 400 }
      );
    }

    const plan = await persistPlan(userId, parsed.data);
    return NextResponse.json({ plan }, { status: 201 });
  } catch (err) {
    if (err instanceof Response) return err;
    const message = err instanceof Error ? err.message : "Failed to create plan";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
