import type { Context, Next } from 'hono';

export async function verifyApiKey(c: Context, next: Next) {
  const apiKey = c.req.header('X-API-Key') ||
                 c.req.header('Authorization')?.replace(/^Bearer\s+/i, '') ||
                 c.req.query('api_key');

  const validKey = (c.env as any)?.API_SECRET_KEY;

  if (!apiKey || !validKey) {
    return c.json({ error: 'API key required' }, 401);
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
