import { Hono } from 'hono';
import { getPool, searchProducts } from '../services/mysql';
import { getWooConfig } from '../lib/config';
import type { Env } from '../index';

export const productsRoute = new Hono<{ Bindings: Env }>();

productsRoute.get('/search', async (c) => {
  const query = c.req.query('q') || '';
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);

  if (!query) {
    return c.json({ error: 'Query parameter "q" is required' }, 400);
  }

  try {
    const wooConfig = getWooConfig(c.env);
    const pool = getPool(wooConfig);
    const products = await searchProducts(pool, query, limit);

    return c.json({
      products,
      count: products.length,
      query,
    });
  } catch (error: any) {
    console.error('Products search error:', error);
    return c.json({
      error: 'Failed to search products',
      details: error.message,
    }, 500);
  }
});

productsRoute.get('/featured', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') || '8'), 20);

  try {
    const wooConfig = getWooConfig(c.env);
    const pool = getPool(wooConfig);

    const [rows] = await pool.query(`
      SELECT
        p.ID as id,
        p.post_title as title,
        pm_sku.meta_value as sku,
        pm_price.meta_value as price,
        pm_stock.meta_value as stock
      FROM wp_posts p
      LEFT JOIN wp_postmeta pm_sku ON p.ID = pm_sku.post_id AND pm_sku.meta_key = '_sku'
      LEFT JOIN wp_postmeta pm_price ON p.ID = pm_price.post_id AND pm_price.meta_key = '_price'
      LEFT JOIN wp_postmeta pm_stock ON p.ID = pm_stock.post_id AND pm_stock.meta_key = '_stock'
      WHERE p.post_type = 'product'
        AND p.post_status = 'publish'
        AND CAST(COALESCE(pm_stock.meta_value, '0') AS SIGNED) > 0
      ORDER BY p.post_modified DESC
      LIMIT ?
    `, [limit]);

    return c.json({
      products: (rows as any[]).map(row => ({
        id: row.id,
        title: row.title,
        sku: row.sku || '',
        price: parseFloat(row.price) || 0,
        stock: parseInt(row.stock) || 0,
      })),
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});
