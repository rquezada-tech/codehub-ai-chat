import { Hono } from 'hono';
import { createERPNextSession } from '../services/erpnext';

export const erpnextRoute = new Hono();

// POST /erpnext/login
erpnextRoute.post('/login', async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>();
  const erpUrl = process.env.ERPNEXT_URL || 'http://erpnext:8088';

  try {
    const session = await createERPNextSession({ baseUrl: erpUrl });
    return c.json(session);
  } catch (error: any) {
    return c.json({ error: error.message || 'Login failed' }, 401);
  }
});
