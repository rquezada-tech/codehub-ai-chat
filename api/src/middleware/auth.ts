import type { Context, Next } from 'hono';

export async function verifyApiKey(c: Context, next: Next) {
  const apiKey = c.req.query('api_key') ||
                 c.req.header('x-api-key') ||
                 c.req.header('authorization')?.replace(/^bearer\s+/i, '');

  const validKey = process.env.API_SECRET_KEY;

  if (!apiKey || !validKey) {
    return c.json({ error: 'API key required', debug: { hasKey: !!apiKey, hasValid: !!validKey } }, 401);
  }

  if (!timingSafeEqual(apiKey, validKey)) {
    return c.json({ error: 'Invalid API key' }, 401);
  }

  await next();
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
