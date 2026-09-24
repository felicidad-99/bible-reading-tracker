import { describe, it, expect } from "vitest";
import { buildPublicDomainUrl } from "@/lib/bible/publicDomainAudio";

async function probe(url: string): Promise<number> {
  const res = await fetch(url, {
    headers: { Range: "bytes=0-1" },
    method: "GET",
  });
  await res.body?.cancel().catch(() => undefined);
  return res.status;
}

describe("Public domain audio live", () => {
  it("serves Genesis 1 with range support", async () => {
    const url = buildPublicDomainUrl("GEN", 1);
    expect(url).toBeTruthy();
    const status = await probe(url!);
    expect([200, 206]).toContain(status);
  }, 30000);

  it("serves John 3", async () => {
    const url = buildPublicDomainUrl("JHN", 3);
    expect(url).toBeTruthy();
    const status = await probe(url!);
    expect([200, 206]).toContain(status);
  }, 30000);

  it("serves Psalm 100", async () => {
    const url = buildPublicDomainUrl("PSA", 100);
    expect(url).toBeTruthy();
    const status = await probe(url!);
    expect([200, 206]).toContain(status);
  }, 30000);

  it("known missing Galatians 7 has no URL", () => {
    expect(buildPublicDomainUrl("GAL", 7)).toBeNull();
  });
});
