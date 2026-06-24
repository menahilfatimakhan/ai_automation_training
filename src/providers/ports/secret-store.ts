/**
 * SecretStore PORT.
 *
 * Resolves a secret REFERENCE (e.g. an ad account's access token) into its
 * plaintext value at the moment of use. `ad_connections.access_token_ref`
 * stores only the reference; the plaintext is never persisted in our tables.
 *
 * The env-backed mock looks the ref up in environment variables. A real
 * implementation (Supabase Vault, AWS Secrets Manager, ...) slots in behind
 * the same interface later.
 */

export interface SecretStore {
  readonly name: string;

  /** Resolve a reference to its plaintext secret, or throw if not found. */
  resolve(ref: string): Promise<string>;

  /**
   * Persist a secret and return a reference to it. Used when a tenant first
   * connects an account. The env-backed mock cannot persist, so it throws.
   */
  store(key: string, value: string): Promise<string>;
}
