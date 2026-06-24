import type { SecretStore } from "@/providers/ports/secret-store";

/**
 * EnvSecretStore — resolves secret references from environment variables.
 *
 * A ref is the name of an env var, optionally prefixed `env:`. For example a
 * connection with `access_token_ref = "env:META_TOKEN_ACME"` resolves to
 * `process.env.META_TOKEN_ACME`. This keeps plaintext tokens out of the DB for
 * MVP; Supabase Vault (or similar) slots in behind the SecretStore port later.
 */
export class EnvSecretStore implements SecretStore {
  readonly name = "env";

  async resolve(ref: string): Promise<string> {
    const varName = ref.startsWith("env:") ? ref.slice(4) : ref;
    const value = process.env[varName];
    if (value === undefined || value === "") {
      throw new Error(
        `SecretStore: no env var for ref "${ref}" (looked up ${varName})`,
      );
    }
    return value;
  }

  async store(): Promise<string> {
    throw new Error(
      "EnvSecretStore cannot persist secrets. Set the env var manually and " +
        "store its name as the ref, or swap in a Vault-backed SecretStore.",
    );
  }
}
