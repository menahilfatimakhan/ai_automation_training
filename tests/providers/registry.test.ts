import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Proves the ports & adapters invariant: which external implementation runs is
 * decided ONLY by env (or an explicit override), and swapping it changes
 * nothing else. If this ever requires touching application code, the seam has
 * leaked and the test should fail.
 */

const BASE_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  DATABASE_URL: "postgresql://localhost:5432/postgres",
  ANTHROPIC_API_KEY: "sk-ant-test",
  FX_PROVIDER: "mock",
  NOTIFIER: "console",
};

async function loadRegistryWith(adProvider: string) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", BASE_ENV.NEXT_PUBLIC_SUPABASE_URL);
  vi.stubEnv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    BASE_ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", BASE_ENV.SUPABASE_SERVICE_ROLE_KEY);
  vi.stubEnv("DATABASE_URL", BASE_ENV.DATABASE_URL);
  vi.stubEnv("ANTHROPIC_API_KEY", BASE_ENV.ANTHROPIC_API_KEY);
  vi.stubEnv("FX_PROVIDER", BASE_ENV.FX_PROVIDER);
  vi.stubEnv("NOTIFIER", BASE_ENV.NOTIFIER);
  vi.stubEnv("AD_PROVIDER", adProvider);
  return import("@/providers/registry");
}

beforeEach(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("provider registry", () => {
  it("selects MockAdProvider when AD_PROVIDER=mock", async () => {
    const { getProviders } = await loadRegistryWith("mock");
    expect(getProviders().ad.name).toBe("mock");
  });

  it("selects MetaAdProvider when AD_PROVIDER=meta", async () => {
    const { getProviders } = await loadRegistryWith("meta");
    expect(getProviders().ad.name).toBe("meta");
  });

  it("always provides the non-ad ports", async () => {
    const { getProviders } = await loadRegistryWith("mock");
    const p = getProviders();
    expect(p.fx.name).toBe("mock");
    expect(p.notifier.name).toBe("console");
    expect(p.secrets.name).toBe("env");
  });

  it("lets a test inject a fake without env (swap = injection only)", async () => {
    const { getProviders } = await loadRegistryWith("mock");
    const fakeAd = {
      name: "fake",
      listCampaigns: async () => [],
      getDailyMetrics: async () => [],
    };
    const p = getProviders({ ad: fakeAd });
    expect(p.ad.name).toBe("fake");
    // Other ports are untouched by the swap.
    expect(p.fx.name).toBe("mock");
    expect(p.notifier.name).toBe("console");
  });
});
