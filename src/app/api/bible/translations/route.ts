import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { bibleService } from "@/lib/bible/bibleService";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const translations = await bibleService.getTranslations();
    return NextResponse.json({ translations });
  } catch {
    return NextResponse.json(
      { error: "Failed to load translations" },
      { status: 502 }
    );
  }
}
