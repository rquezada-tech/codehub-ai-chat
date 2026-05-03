import { Hono } from 'hono';
import { getPool, searchProducts } from '../services/mysql';
import { getWooConfig } from '../lib/config';
import type { Env } from '../index';

export const productsRoute = new Hono<{ Bindings: Env }>();

// GET /products/search?q=...&limit=20
productsRoute.get('/search', async (c) => {
  const query = c.req.query('q') || '';
  const limit = parseInt(c.req.query('limit') || '20');

  const env = c.env as Env;
  const config = getWooConfig(env as Record<string, string>);

  const pool = getPool(config);
  const products = await searchProducts(pool, query, limit);
  return c.json({ products });
});

// GET /products/:id
productsRoute.get('/:id', async (c) => {
  const id = c.req.param('id');

  const env = c.env as Env;
  const config = getWooConfig(env as Record<string, string>);

  const pool = getPool(config);
  const [[product]] = await pool.query(
    'SELECT * FROM wp_posts p LEFT JOIN wp_postmeta m ON p.ID = m.post_id WHERE p.ID = ? AND p.post_type = "product" LIMIT 50',
    [id]
  );

  return c.json({ product });
});
