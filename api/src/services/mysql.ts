import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export function getPool(config: {
  host: string;
  user: string;
  password: string;
  database: string;
}): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: config.host,
      user: config.user,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return pool;
}

export interface WooProduct {
  id: number;
  title: string;
  sku: string;
  price: number;
  stock: number;
  description: string;
  categories: string[];
  image: string | null;
}

interface WooProductRow {
  id: number;
  title: string | null;
  sku: string | null;
  price: string | null;
  stock: string | null;
  description: string | null;
  image: string | null;
}

export async function searchProducts(
  pool: mysql.Pool,
  query: string,
  limit = 20
): Promise<WooProduct[]> {
  const searchTerm = `%${query}%`;

  const [rows] = await pool.query(
    `SELECT p.ID as id, p.post_title as title, pm_sku.meta_value as sku,
            pm_price.meta_value as price, pm_stock.meta_value as stock,
            p.post_content as description, pm_image.guid as image
     FROM wp_posts p
     LEFT JOIN wp_postmeta pm_sku ON p.ID = pm_sku.post_id AND pm_sku.meta_key = '_sku'
     LEFT JOIN wp_postmeta pm_price ON p.ID = pm_price.post_id AND pm_price.meta_key = '_price'
     LEFT JOIN wp_postmeta pm_stock ON p.ID = pm_stock.post_id AND pm_stock.meta_key = '_stock'
     LEFT JOIN wp_postmeta pm_image ON p.ID = pm_image.post_id AND pm_image.meta_key = '_thumbnail_id'
     LEFT JOIN wp_posts pm_img ON pm_image.meta_value = pm_img.ID
     WHERE p.post_type = 'product'
       AND p.post_status = 'publish'
       AND (p.post_title LIKE ? OR p.post_content LIKE ? OR pm_sku.meta_value LIKE ?)
     ORDER BY p.post_date DESC
     LIMIT ?`,
    [searchTerm, searchTerm, searchTerm, limit]
  );

  const typedRows = rows as WooProductRow[];

  return typedRows.map((row) => ({
    id: row.id,
    title: row.title || '',
    sku: row.sku || '',
    price: parseFloat(row.price || '0') || 0,
    stock: parseInt(row.stock || '0') || 0,
    description: row.description || '',
    categories: [],
    image: row.image || null,
  }));
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
