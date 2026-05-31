/**
 * Server-only: validates required environment variables at call time.
 * Import only from API routes or Server Components — never from client code.
 */
export function getAnthropicApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. ' +
        'Add it to .env.local for local development, ' +
        'or set it as an environment variable in Vercel.'
    );
  }
  return key;
}
