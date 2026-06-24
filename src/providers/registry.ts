import { serverEnv } from "@/lib/env";
import type { AdProvider } from "@/providers/ports/ad-provider";
import type { FxProvider } from "@/providers/ports/fx-provider";
import type { Notifier } from "@/providers/ports/notifier";
import type { SecretStore } from "@/providers/ports/secret-store";
import type { AiProvider } from "@/providers/ports/ai-provider";

import { MockAdProvider } from "@/providers/ad/mock-ad-provider";
import { MetaAdProvider } from "@/providers/ad/meta-ad-provider";
import { MockFxProvider } from "@/providers/fx/mock-fx-provider";
import { ConsoleNotifier } from "@/providers/notifier/console-notifier";
import { DbNotifier } from "@/providers/notifier/db-notifier";
import { EnvSecretStore } from "@/providers/secret-store/env-secret-store";
import { MockAiProvider } from "@/providers/ai/mock-ai-provider";
import { AnthropicAiProvider } from "@/providers/ai/anthropic-ai-provider";

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
  ai: AiProvider;
}

export interface ProviderOverrides {
  ad?: AdProvider;
  fx?: FxProvider;
  notifier?: Notifier;
  secrets?: SecretStore;
  ai?: AiProvider;
}

function selectAdProvider(kind: "mock" | "meta"): AdProvider {
  switch (kind) {
    case "mock":
      return new MockAdProvider();
    case "meta":
      return new MetaAdProvider();
  }
}

function selectNotifier(kind: "console" | "db"): Notifier {
  return kind === "db" ? new DbNotifier() : new ConsoleNotifier();
}

function selectAiProvider(
  kind: "mock" | "anthropic",
  apiKey: string,
): AiProvider {
  // Fall back to the mock if anthropic is selected without a usable key.
  if (kind === "anthropic" && apiKey && !apiKey.includes("placeholder")) {
    return new AnthropicAiProvider(apiKey);
  }
  return new MockAiProvider();
}

/**
 * Build the provider set. Reads env by default; `overrides` win when provided.
 */
export function getProviders(overrides: ProviderOverrides = {}): Providers {
  const env = serverEnv();
  return {
    ad: overrides.ad ?? selectAdProvider(env.AD_PROVIDER),
    fx: overrides.fx ?? new MockFxProvider(),
    notifier: overrides.notifier ?? selectNotifier(env.NOTIFIER),
    secrets: overrides.secrets ?? new EnvSecretStore(),
    ai: overrides.ai ?? selectAiProvider(env.AI_PROVIDER, env.ANTHROPIC_API_KEY),
  };
}
