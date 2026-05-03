import { Hono } from 'hono';
import { getPool, searchProducts } from '../services/mysql';

export const productsRoute = new Hono();

// GET /products/search?q=...&limit=20
productsRoute.get('/search', async (c) => {
  const query = c.req.query('q') || '';
  const limit = parseInt(c.req.query('limit') || '20');

  const config = {
    host: process.env.MYSQL_HOST || 'srv-captain--mysql-db',
    user: process.env.MYSQL_USER || 'store',
    password: process.env.MYSQL_PASSWORD || 'StoreCodeHub2026!',
    database: process.env.MYSQL_DATABASE || 'store',
  };

  const pool = getPool(config);
  const products = await searchProducts(pool, query, limit);
  return c.json({ products });
});

// GET /products/:id
productsRoute.get('/:id', async (c) => {
  const id = c.req.param('id');

  const config = {
    host: process.env.MYSQL_HOST || 'srv-captain--mysql-db',
    user: process.env.MYSQL_USER || 'store',
    password: process.env.MYSQL_PASSWORD || 'StoreCodeHub2026!',
    database: process.env.MYSQL_DATABASE || 'store',
  };

  const pool = getPool(config);
  const [rows] = await pool.query(
    'SELECT p.ID as id, p.post_title as title, pm_sku.meta_value as sku, ' +
    'pm_price.meta_value as price, pm_stock.meta_value as stock, p.post_content as description ' +
    'FROM wp_posts p ' +
    'LEFT JOIN wp_postmeta pm_sku ON p.ID = pm_sku.post_id AND pm_sku.meta_key = "_sku" ' +
    'LEFT JOIN wp_postmeta pm_price ON p.ID = pm_price.post_id AND pm_price.meta_key = "_price" ' +
    'LEFT JOIN wp_postmeta pm_stock ON p.ID = pm_stock.post_id AND pm_stock.meta_key = "_stock" ' +
    'WHERE p.ID = ? AND p.post_type = "product" AND p.post_status = "publish" LIMIT 1',
    [id]
  );

  return c.json({ product: (rows as any[])[0] || null });
});
