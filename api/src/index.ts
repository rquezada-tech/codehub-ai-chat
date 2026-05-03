import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { verifyApiKey } from './middleware/auth';
import { chatRoute } from './routes/chat';
import { productsRoute } from './routes/products';
import { erpnextRoute } from './routes/erpnext';

const app = new Hono();

// CORS: solo desde codehub.cl y sus subdominios
app.use('*', cors({
  origin: (origin) => {
    if (!origin) return false;
    try {
      const url = new URL(origin);
      const allowedHosts = [
        'codehub.cl',
        '.codehub.cl',  // cualquier subdominio
        'localhost',
        '127.0.0.1',
      ];
      const host = url.hostname;
      return allowedHosts.some(allowed =>
        host === allowed || host.endsWith('.' + allowed)
      );
    } catch {
      return false;
    }
  },
  allowHeaders: ['Authorization', 'Content-Type', 'X-API-Key'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
  maxAge: 86400,
}));

// Health check público (sin auth)
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Rutas protegidas con API key
app.use('/chat/*', verifyApiKey);
app.use('/products/*', verifyApiKey);
app.use('/erpnext/*', verifyApiKey);

app.route('/chat', chatRoute);
app.route('/products', productsRoute);
app.route('/erpnext', erpnextRoute);

const port = 3001;
console.log(`🚀 CodeHub AI Chat API running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});

export default app;
