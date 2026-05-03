import { Hono } from 'hono';
import { createERPNextSession } from '../services/erpnext';
import type { Env } from '../index';

export const erpnextRoute = new Hono<{ Bindings: Env }>();

// POST /erpnext/login
erpnextRoute.post('/login', async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>();
  const env = c.env as Env;
  const erpUrl = env.ERPNEXT_URL || 'http://erpnext:8088';

  try {
    const session = await createERPNextSession(erpUrl, email, password);
    return c.json(session);
  } catch (error: any) {
    return c.json({ error: error.message || 'Login failed' }, 401);
  }
});

// POST /erpnext/lead - Crear lead en ERPNext
erpnextRoute.post('/lead', async (c) => {
  const data = await c.req.json();
  const env = c.env as Env;
  // Implementation would go here
  return c.json({ error: 'Not implemented' }, 501);
});
