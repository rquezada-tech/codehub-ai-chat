import { Hono } from 'hono';
import { createERPNextSession } from '../services/erpnext';

export const erpnextRoute = new Hono();

// POST /erpnext/login
erpnextRoute.post('/login', async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>();
  const env = c.env as any;
  const erpUrl = env.ERPNEXT_URL || 'http://erpnext:8088';

  try {
    const session = await createERPNextSession(erpUrl, email, password);
    return c.json(session);
  } catch (error: any) {
    return c.json({ error: error.message || 'Login failed' }, 401);
  }
});
