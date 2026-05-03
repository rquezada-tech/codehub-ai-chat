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
  image?: string;
}

export async function searchProducts(db: mysql.Pool, query: string, limit = 20): Promise<WooProduct[]> {
  const searchTerm = `%${query}%`;

  const [rows] = await db.query(`
    SELECT
      p.ID as id,
      p.post_title as title,
      pm_sku.meta_value as sku,
      pm_price.meta_value as price,
      pm_stock.meta_value as stock,
      p.post_content as description
    FROM wp_posts p
    LEFT JOIN wp_postmeta pm_sku ON p.ID = pm_sku.post_id AND pm_sku.meta_key = '_sku'
    LEFT JOIN wp_postmeta pm_price ON p.ID = pm_price.post_id AND pm_price.meta_key = '_price'
    LEFT JOIN wp_postmeta pm_stock ON p.ID = pm_stock.post_id AND pm_stock.meta_key = '_stock'
    WHERE p.post_type = 'product'
      AND p.post_status = 'publish'
      AND (
        p.post_title LIKE ?
        OR pm_sku.meta_value LIKE ?
        OR p.post_content LIKE ?
      )
      AND CAST(COALESCE(pm_stock.meta_value, '0') AS SIGNED) > 0
    ORDER BY p.post_modified DESC
    LIMIT ?
  `, [searchTerm, searchTerm, searchTerm, limit]);

  const products: WooProduct[] = (rows as any[]).map((row) => ({
    id: row.id,
    title: row.title || '',
    sku: row.sku || '',
    price: parseFloat(row.price) || 0,
    stock: parseInt(row.stock) || 0,
    description: stripHtml(row.description || ''),
    categories: [] as string[],
    image: undefined,
  }));

  // Fetch categories and image for each product
  for (const product of products) {
    const [catRows] = await db.query(`
      SELECT t.name
      FROM wp_term_relationships tr
      JOIN wp_term_taxonomy tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
      JOIN wp_terms t ON tt.term_id = t.term_id
      WHERE tr.object_id = ? AND tt.taxonomy = 'product_cat'
    `, [product.id]);
    product.categories = (catRows as any[]).map((r) => r.name);

    // Get main product image
    const [imgRows] = await db.query(`
      SELECT guid FROM wp_posts
      WHERE post_parent = ? AND post_type = 'attachment' AND post_mime_type LIKE 'image%'
      ORDER BY menu_order ASC LIMIT 1
    `, [product.id]);
    if ((imgRows as any[]).length > 0) {
      product.image = (imgRows as any[])[0].guid;
    }
  }

  return products;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}
