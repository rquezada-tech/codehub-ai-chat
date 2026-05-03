import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { verifyApiKey } from './middleware/auth';
import { chatRoute } from './routes/chat';
import { productsRoute } from './routes/products';
import { erpnextRoute } from './routes/erpnext';

export interface Env {
  API_SECRET_KEY: string;
  OLLAMA_HOST: string;
  OLLAMA_MODEL: string;
  MYSQL_HOST: string;
  MYSQL_USER: string;
  MYSQL_PASSWORD: string;
  MYSQL_DATABASE: string;
  ERPNEXT_URL: string;
}

const app = new Hono<{ Bindings: Env }>();

// CORS: solo desde codehub.cl y sus subdominios
app.use('*', cors({
  origin: (origin) => {
    if (!origin) return '*'; // allow requests without origin (curl, server-to-server)
    try {
      const url = new URL(origin);
      const allowedDomains = ['codehub.cl', 'localhost', '127.0.0.1'];
      const host = url.hostname;
      const isAllowed = allowedDomains.some(d => host === d || host.endsWith('.' + d));
      return isAllowed ? origin : '';
    } catch {
      return '';
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
