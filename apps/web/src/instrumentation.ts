/**
 * Runs once per server instance. Background cache refreshes are handed to
 * Next's `after()` so they finish after the response is sent (Vercel keeps
 * the function alive via waitUntil); outside a request they simply run
 * detached.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const [{ setBackgroundRunner }, { after }] = await Promise.all([import('@marutime/core/cache'), import('next/server')]);
  setBackgroundRunner((task) => {
    try {
      after(task);
    } catch {
      void task();
    }
  });
}
