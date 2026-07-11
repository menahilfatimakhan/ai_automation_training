/**
 * Slack workspace metadata — resolved from the bot token itself via
 * `auth.test`, rather than asking the admin to look up and paste a workspace
 * ID. Cached in-memory for the life of the server process (this rarely, if
 * ever, changes).
 */

let cached: { workspaceUrl: string } | null | undefined;

/** The workspace's base URL (e.g. "https://youragency.slack.com/"), or null if unavailable. */
export async function getSlackWorkspaceUrl(token: string): Promise<string | null> {
  if (!token) return null;
  if (cached !== undefined) return cached?.workspaceUrl ?? null;

  try {
    const resp = await fetch("https://slack.com/api/auth.test", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = (await resp.json()) as { ok: boolean; url?: string };
    if (json.ok && json.url) {
      cached = { workspaceUrl: json.url };
      return json.url;
    }
  } catch (err) {
    console.error("getSlackWorkspaceUrl: auth.test failed:", err);
  }
  cached = null;
  return null;
}

/** Direct link to a channel in the workspace (opens the Slack app or web client). */
export function slackChannelUrl(workspaceUrl: string, channelId: string): string {
  return `${workspaceUrl.replace(/\/$/, "")}/archives/${channelId}`;
}
