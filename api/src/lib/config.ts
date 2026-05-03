export interface WooConfig {
  host: string;
  user: string;
  password: string;
  database: string;
}

export function getWooConfig(env: Record<string, string>): WooConfig {
  return {
    host: env.MYSQL_HOST || 'srv-captain--mysql-db',
    user: env.MYSQL_USER || 'store',
    password: env.MYSQL_PASSWORD || 'StoreCodeHub2026!',
    database: env.MYSQL_DATABASE || 'store',
  };
}
