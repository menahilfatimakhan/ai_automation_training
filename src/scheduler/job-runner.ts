/**
 * Shared job-execution wrapper: logs start/success/failure and retries once
 * on failure before giving up, so one bad run (a transient network blip, a
 * momentarily-down FX API) doesn't need a human to notice and re-trigger it.
 * Every scheduled job in index.ts goes through this — failures are isolated
 * per client/job, never allowed to take down the rest of the run.
 */
export async function runJob(label: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    console.info(`[scheduler] OK   ${label} (${Date.now() - start}ms)`);
  } catch (err) {
    console.error(`[scheduler] FAIL ${label} — retrying once:`, err);
    try {
      await fn();
      console.info(`[scheduler] OK   ${label} on retry (${Date.now() - start}ms)`);
    } catch (retryErr) {
      console.error(`[scheduler] FAIL ${label} — retry also failed, giving up this run:`, retryErr);
    }
  }
}
