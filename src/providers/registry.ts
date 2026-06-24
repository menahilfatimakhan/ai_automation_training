import { serverEnv } from "@/lib/env";
import type { AdProvider } from "@/providers/ports/ad-provider";
import type { FxProvider } from "@/providers/ports/fx-provider";
import type { Notifier } from "@/providers/ports/notifier";
import type { SecretStore } from "@/providers/ports/secret-store";

import { MockAdProvider } from "@/providers/ad/mock-ad-provider";
import { MetaAdProvider } from "@/providers/ad/meta-ad-provider";
import { MockFxProvider } from "@/providers/fx/mock-fx-provider";
import { ConsoleNotifier } from "@/providers/notifier/console-notifier";
import { EnvSecretStore } from "@/providers/secret-store/env-secret-store";

/**
 * PROVIDER REGISTRY — the single composition root for external edges.
 *
 * Every external dependency is resolved here from env. Application code asks
 * the registry for a port and never constructs a concrete implementation
 * itself. Swapping mock → real is a one-line change here (or just an env flag),
 * never a refactor — and tests assert exactly that.
 *
 * For tests, pass an explicit `overrides` object to inject fakes without
 * touching env.
 */

export interface Providers {
  ad: AdProvider;
  fx: FxProvider;
  notifier: Notifier;
  secrets: SecretStore;
}

export interface ProviderOverrides {
  ad?: AdProvider;
  fx?: FxProvider;
  notifier?: Notifier;
  secrets?: SecretStore;
}

function selectAdProvider(kind: "mock" | "meta"): AdProvider {
  switch (kind) {
    case "mock":
      return new MockAdProvider();
    case "meta":
      return new MetaAdProvider();
  }
}

/**
 * Build the provider set. Reads env by default; `overrides` win when provided.
 */
export function getProviders(overrides: ProviderOverrides = {}): Providers {
  const env = serverEnv();
  return {
    ad: overrides.ad ?? selectAdProvider(env.AD_PROVIDER),
    fx: overrides.fx ?? new MockFxProvider(),
    notifier: overrides.notifier ?? new ConsoleNotifier(),
    secrets: overrides.secrets ?? new EnvSecretStore(),
  };
}
