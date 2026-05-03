import { Hono } from 'hono';
import { createERPNextSession } from '../services/erpnext';

export const erpnextRoute = new Hono();

// Login to ERPNext
erpnextRoute.post('/login', async (c) => {
  const { email, password } = await c.req.json();

  if (!email || !password) {
    return c.json({ error: 'email and password required' }, 400);
  }

  try {
    const erpUrl = c.env.ERPNEXT_URL || 'http://localhost:8088';

    // Create session via ERPNext API
    const response = await fetch(`${erpUrl}/api/method/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usr: email, pwd: password }),
    });

    const setCookie = response.headers.get('set-cookie') || '';
    const data = await response.json();

    if (data.message !== 'Logged In') {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    return c.json({
      success: true,
      cookies: setCookie,
      message: 'Logged In',
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Create a lead from chat conversation
erpnextRoute.post('/lead', async (c) => {
  const { firstName, lastName, email, phone, company, notes } = await c.req.json();

  const cookies = c.req.header('Cookie');
  if (!cookies) {
    return c.json({ error: 'Authentication required. Call /erpnext/login first.' }, 401);
  }

  try {
    const erpUrl = c.env.ERPNEXT_URL || 'http://localhost:8088';
    const client = await createERPNextSession({ baseUrl: erpUrl, cookies });
    const result = await client.createLead({ firstName, lastName, email, phone, type: 'Lead', company, notes });

    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Create a customer
erpnextRoute.post('/customer', async (c) => {
  const { firstName, lastName, email, phone, company, notes } = await c.req.json();

  const cookies = c.req.header('Cookie');
  if (!cookies) {
    return c.json({ error: 'Authentication required. Call /erpnext/login first.' }, 401);
  }

  try {
    const erpUrl = c.env.ERPNEXT_URL || 'http://localhost:8088';
    const client = await createERPNextSession({ baseUrl: erpUrl, cookies });
    const result = await client.createCustomer({ firstName, lastName, email, phone, type: 'Customer', company, notes });

    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Create sales order
erpnextRoute.post('/sales-order', async (c) => {
  const { customerId, items, notes } = await c.req.json();

  if (!customerId || !items || !Array.isArray(items) || items.length === 0) {
    return c.json({ error: 'customerId and items array required' }, 400);
  }

  const cookies = c.req.header('Cookie');
  if (!cookies) {
    return c.json({ error: 'Authentication required. Call /erpnext/login first.' }, 401);
  }

  try {
    const erpUrl = c.env.ERPNEXT_URL || 'http://localhost:8088';
    const client = await createERPNextSession({ baseUrl: erpUrl, cookies });
    const result = await client.createSalesOrder({ customerId, items, notes });

    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});
