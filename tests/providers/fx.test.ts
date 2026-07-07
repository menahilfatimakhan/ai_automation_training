import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveFxProvider } from "@/providers/fx/live-fx-provider";

/**
 * The LiveFxProvider fetches real rates from the ECB/Frankfurter API, caches
 * them, and falls back to static rates on failure so KPI math never breaks.
 */
describe("LiveFxProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 1 for same-currency without calling the API", async () => {
    const fx = new LiveFxProvider();
    const spy = vi.spyOn(global, "fetch");
    expect(await fx.getRate("USD", "USD")).toBe(1);
    expect(await fx.convert(100, "USD", "USD")).toBe(100);
    expect(spy).not.toHaveBeenCalled();
  });

  it("uses the live API rate and caches it (one call for repeats)", async () => {
    const fx = new LiveFxProvider();
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ rates: { EUR: 0.9 } }), { status: 200 }),
    );
    expect(await fx.getRate("USD", "EUR")).toBe(0.9);
    expect(await fx.convert(100, "USD", "EUR")).toBeCloseTo(90, 6);
    // Second identical lookup is served from cache.
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("falls back to static rates when the API fails", async () => {
    const fx = new LiveFxProvider();
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network down"));
    // MockFxProvider fallback: EUR→USD ≈ 1.08 / 1 = 1.08
    const rate = await fx.getRate("EUR", "USD");
    expect(rate).toBeGreaterThan(1);
  });
});
