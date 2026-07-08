import { serverEnv } from "@/lib/env";
import type { AdProvider } from "@/providers/ports/ad-provider";
import type { FxProvider } from "@/providers/ports/fx-provider";
import type { Notifier } from "@/providers/ports/notifier";
import type { SecretStore } from "@/providers/ports/secret-store";
import type { AiProvider } from "@/providers/ports/ai-provider";

import { MockAdProvider } from "@/providers/ad/mock-ad-provider";
import { MetaAdProvider } from "@/providers/ad/meta-ad-provider";
import { MockFxProvider } from "@/providers/fx/mock-fx-provider";
import { LiveFxProvider } from "@/providers/fx/live-fx-provider";
import { ConsoleNotifier } from "@/providers/notifier/console-notifier";
import { DbNotifier } from "@/providers/notifier/db-notifier";
import { SlackNotifier } from "@/providers/notifier/slack-notifier";
import { EnvSecretStore } from "@/providers/secret-store/env-secret-store";
import { MockAiProvider } from "@/providers/ai/mock-ai-provider";
import { AnthropicAiProvider } from "@/providers/ai/anthropic-ai-provider";
import type { EmailProvider } from "@/providers/ports/email-provider";
import { ConsoleEmailProvider } from "@/providers/email/console-email-provider";
import { ResendEmailProvider } from "@/providers/email/resend-email-provider";

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
  email: EmailProvider;
}

export interface ProviderOverrides {
  ad?: AdProvider;
  fx?: FxProvider;
  notifier?: Notifier;
  secrets?: SecretStore;
  ai?: AiProvider;
  email?: EmailProvider;
}

function selectAdProvider(kind: "mock" | "meta"): AdProvider {
  switch (kind) {
    case "mock":
      return new MockAdProvider();
    case "meta":
      return new MetaAdProvider();
  }
}

function selectFxProvider(kind: "mock" | "live"): FxProvider {
  return kind === "live" ? new LiveFxProvider() : new MockFxProvider();
}

function selectNotifier(kind: "console" | "db" | "slack", slackToken: string): Notifier {
  if (kind === "slack") {
    // Fall back to DbNotifier (in-app only) if no bot token is configured yet.
    if (slackToken) return new SlackNotifier(slackToken);
    return new DbNotifier();
  }
  return kind === "db" ? new DbNotifier() : new ConsoleNotifier();
}

function selectEmailProvider(kind: "console" | "resend", apiKey: string, from: string): EmailProvider {
  if (kind === "resend" && apiKey) return new ResendEmailProvider(apiKey, from);
  return new ConsoleEmailProvider();
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
    fx: overrides.fx ?? selectFxProvider(env.FX_PROVIDER),
    notifier: overrides.notifier ?? selectNotifier(env.NOTIFIER, env.SLACK_BOT_TOKEN),
    secrets: overrides.secrets ?? new EnvSecretStore(),
    ai: overrides.ai ?? selectAiProvider(env.AI_PROVIDER, env.ANTHROPIC_API_KEY),
    email: overrides.email ?? selectEmailProvider(env.EMAIL_PROVIDER, env.RESEND_API_KEY, env.EMAIL_FROM),
  };
}
