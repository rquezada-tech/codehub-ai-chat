# AI Chatbot Advisor para CodeHub Store — Plan de Implementación

> **Goal:** Plugin de WooCommerce + API en subdominio con LLM local para asesoría de productos, cotizaciones y comparaciones. Registra conversaciones en ERPNext como leads y órdenes de venta.

**Architecture:**
- **LLM Server**: Ollama con `mistral:7b-instruct-q4_0` (~4GB, 4-bit quantization) en Docker
- **Chat API**: Hono.js microservicio en Docker (CapRover) serving como bridge LLM + RAG
- **WooCommerce**: Plugin que conecta al API y provee config de prompts
- **ERPNext**: REST API para crear Contactos/Leads y Sales Orders
- **MySQL Directo**: Lectura de productos WooCommerce para RAG

**Tech Stack:** Ollama, Hono.js, TypeScript, Docker, WordPress Plugin (PHP), MySQL, ERPNext REST API

**Repos afectados:**
- [ ] `codehub-ai-chat` (nuevo repositorio)
- [ ] `codehub-tecnoglobal-manager` (plugin WooCommerce existente — NO se modifica)

---

## Estructura de Archivos

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `docker-compose.yml` | Crear | Orquestación de servicios (Ollama + API) |
| `ollama/Dockerfile` | Crear | Imagen personalizada Ollama con modelo |
| `api/src/index.ts` | Crear | Entry point Hono API |
| `api/src/routes/chat.ts` | Crear | Endpoint `/chat` — streaming de LLM |
| `api/src/routes/products.ts` | Crear | Endpoint `/products/search` — búsqueda RAG |
| `api/src/services/ollama.ts` | Crear | Cliente Ollama REST |
| `api/src/services/erpnext.ts` | Crear | Cliente ERPNext API |
| `api/src/services/mysql.ts` | Crear | Cliente MySQL WooCommerce |
| `api/src/lib/prompts.ts` | Crear | Templates de prompts base |
| `api/src/middleware/auth.ts` | Crear | Auth por API key |
| `api/src/test/*.test.ts` | Crear | Tests unitarios |
| `plugin/codehub-ai-advisor/codehub-ai-advisor.php` | Crear | Plugin principal |
| `plugin/codehub-ai-advisor/includes/class-settings.php` | Crear | Admin settings page |
| `plugin/codehub-ai-advisor/includes/class-api-client.php` | Crear | Cliente REST al Chat API |
| `plugin/codehub-ai-advisor/includes/class-widget.php` | Crear | Chat widget frontend |

---

## Task 1: Estructura del Repositorio y Docker

**Files:**
- Create: `docker-compose.yml`
- Create: `api/package.json`
- Create: `api/tsconfig.json`
- Create: `api/src/index.ts`
- Create: `ollama/Dockerfile`

- [ ] **Step 1: Crear estructura base del repositorio**

```bash
mkdir -p ~/External/repos/codehub/codehub-ai-chat/{api/src/{routes,services,lib,middleware,test},plugin/codehub-ai-advisor/includes,ollama}
cd ~/External/repos/codehub/codehub-ai-chat
git init
```

- [ ] **Step 2: Crear docker-compose.yml**

```yaml
version: '3.8'
services:
  ollama:
    build: ./ollama
    container_name: codehub-ai-ollama
    ports:
      - "11434:11434"
    volumes:
      ollama_data:/root/.ollama
    deploy:
      resources:
        limits:
          memory: 4G
        reservations:
          memory: 2G
    networks:
      - codehub-ai-net

  api:
    build:
      context: ./api
      dockerfile: ../ollama/Dockerfile.api
    container_name: codehub-ai-api
    ports:
      - "3001:3001"
    environment:
      OLLAMA_HOST: http://ollama:11434
      MYSQL_HOST: ${MYSQL_HOST}
      MYSQL_USER: ${MYSQL_USER}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
      MYSQL_DATABASE: ${MYSQL_DATABASE}
      ERPNEXT_URL: ${ERPNEXT_URL}
      ERPNEXT_API_KEY: ${ERPNEXT_API_KEY}
      ERPNEXT_API_SECRET: ${ERPNEXT_API_SECRET}
      API_SECRET_KEY: ${API_SECRET_KEY}
    depends_on:
      - ollama
    networks:
      - codehub-ai-net

networks:
  codehub-ai-net:
    driver: bridge

volumes:
  ollama_data:
```

- [ ] **Step 3: Crear Dockerfile de Ollama**

```dockerfile
FROM ollama/ollama:latest
RUN ollama pull mistral:7b-instruct-q4_0
```

- [ ] **Step 4: Crear Dockerfile del API**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: initial repo structure and docker setup"
```

---

## Task 2: Hono API — Core y Middleware

**Files:**
- Create: `api/src/index.ts`
- Create: `api/src/middleware/auth.ts`
- Create: `api/src/test/auth.test.ts`

- [ ] **Step 1: Escribir test que falla**

```typescript
// api/src/test/auth.test.ts
import { describe, it, expect } from 'vitest';
import { verifyApiKey } from '../middleware/auth';

describe('API Key Auth', () => {
  it('should reject request without Authorization header', async () => {
    const ctx = {
      req: { header: () => undefined },
      json: vi.fn(),
      status: 401,
    } as any;
    
    await verifyApiKey(ctx, () => Promise.resolve());
    expect(ctx.status).toBe(401);
  });
  
  it('should reject request with invalid API key', async () => {
    const ctx = {
      req: { header: () => 'Bearer invalid-key' },
      env: { API_SECRET_KEY: 'valid-key' },
      json: vi.fn(),
      status: 401,
    } as any;
    
    await verifyApiKey(ctx, () => Promise.resolve());
    expect(ctx.status).toBe(401);
  });
  
  it('should pass request with valid API key', async () => {
    const next = vi.fn().mockResolvedValue(undefined);
    const ctx = {
      req: { header: () => 'Bearer valid-key' },
      env: { API_SECRET_KEY: 'valid-key' },
    } as any;
    
    await verifyApiKey(ctx, next);
    expect(next).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correr test, verificar que falla**

```bash
cd ~/External/repos/codehub/codehub-ai-chat/api && npm test
# Expected: FAIL — verifyApiKey not defined yet
```

- [ ] **Step 3: Implementar código mínimo**

```typescript
// api/src/middleware/auth.ts
export async function verifyApiKey(c: any, next: () => Promise<void>) {
  const authHeader = c.req.header('Authorization');
  const apiKey = c.env?.API_SECRET_KEY;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    c.status = 401;
    return c.json({ error: 'Missing Authorization header' });
  }
  
  const token = authHeader.slice(7);
  if (token !== apiKey) {
    c.status = 401;
    return c.json({ error: 'Invalid API key' });
  }
  
  await next();
}
```

- [ ] **Step 4: Correr test, verificar que pasa**

```bash
cd ~/External/repos/codehub/codehub-ai-chat/api && npm test
# Expected: PASS
```

- [ ] **Step 5: Implementar index.ts base**

```typescript
// api/src/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { verifyApiKey } from './middleware/auth';
import { chatRoute } from './routes/chat';
import { productsRoute } from './routes/products';

const app = new Hono();

app.use('*', cors());
app.use('/chat', verifyApiKey);
app.use('/products/*', verifyApiKey);

app.route('/chat', chatRoute);
app.route('/products', productsRoute);

app.get('/health', (c) => c.json({ status: 'ok' }));

export default {
  port: 3001,
  fetch: app.fetch,
};
```

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat(api): core Hono app with API key auth middleware"
```

---

## Task 3: Servicio MySQL — Lectura de Productos WooCommerce

**Files:**
- Create: `api/src/services/mysql.ts`
- Create: `api/src/test/mysql.test.ts`

- [ ] **Step 1: Escribir test que falla**

```typescript
// api/src/test/mysql.test.ts
import { describe, it, expect, vi } from 'vitest';
import { searchProducts } from '../services/mysql';

describe('Product Search', () => {
  it('should search products by name', async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValue([[
        { ID: 1, post_title: 'Mouse Gaming RGB', _price: 29.99, _stock: 10 }
      ]]),
    };
    
    const results = await searchProducts(mockDb as any, 'mouse');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Mouse Gaming RGB');
  });
  
  it('should return empty array for no matches', async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValue([[]]),
    };
    
    const results = await searchProducts(mockDb as any, 'nonexistent');
    expect(results).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Correr test, verificar que falla**

```bash
cd ~/External/repos/codehub/codehub-ai-chat/api && npm test
# Expected: FAIL — searchProducts not defined yet
```

- [ ] **Step 3: Implementar código mínimo**

```typescript
// api/src/services/mysql.ts
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
      AND (p.post_title LIKE ? OR pm_sku.meta_value LIKE ? OR p.post_content LIKE ?)
      AND CAST(pm_stock.meta_value AS SIGNED) > 0
    LIMIT ?
  `, [searchTerm, searchTerm, searchTerm, limit]);
  
  const products = (rows as any[]).map((row) => ({
    id: row.id,
    title: row.title || '',
    sku: row.sku || '',
    price: parseFloat(row.price) || 0,
    stock: parseInt(row.stock) || 0,
    description: row.description || '',
    categories: [],
  }));
  
  // Fetch categories for each product
  for (const product of products) {
    const [catRows] = await db.query(`
      SELECT t.name 
      FROM wp_term_relationships tr
      JOIN wp_term_taxonomy tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
      JOIN wp_terms t ON tt.term_id = t.term_id
      WHERE tr.object_id = ? AND tt.taxonomy = 'product_cat'
    `, [product.id]);
    product.categories = (catRows as any[]).map((r) => r.name);
  }
  
  return products;
}
```

- [ ] **Step 4: Correr test, verificar que pasa**

```bash
cd ~/External/repos/codehub/codehub-ai-chat/api && npm test
# Expected: PASS
```

- [ ] **Step 5: Refactor**

N/A — código mínimo y limpio.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat(api): MySQL service for WooCommerce product search"
```

---

## Task 4: Servicio ERPNext — CRM Integration

**Files:**
- Create: `api/src/services/erpnext.ts`
- Create: `api/src/test/erpnext.test.ts`

- [ ] **Step 1: Escribir test que falla**

```typescript
// api/src/test/erpnext.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createCustomer, createSalesOrder } from '../services/erpnext';

describe('ERPNext Service', () => {
  it('should create a lead from chat conversation', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { name: 'Lead-001' } }),
    });
    global.fetch = mockFetch;
    
    const result = await createCustomer({
      firstName: 'Juan',
      lastName: 'Pérez',
      email: 'juan@example.com',
      phone: '+56912345678',
      type: 'Lead',
    }, { url: 'https://erp.codehub.cl', apiKey: 'key', apiSecret: 'secret' } as any);
    
    expect(result.id).toBe('Lead-001');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/resource/Lead'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});
```

- [ ] **Step 2: Correr test, verificar que falla**

```bash
cd ~/External/repos/codehub/codehub-ai-chat/api && npm test
# Expected: FAIL — createCustomer not defined yet
```

- [ ] **Step 3: Implementar código mínimo**

```typescript
// api/src/services/erpnext.ts

export interface CustomerPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  type: 'Lead' | 'Customer';
  company?: string; // For B2B
  notes?: string;
}

export interface ERPNextConfig {
  url: string;
  apiKey: string;
  apiSecret: string;
}

async function erpnextRequest(
  config: ERPNextConfig,
  method: string,
  endpoint: string,
  body?: object
) {
  const auth = Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64');
  
  const response = await fetch(`${config.url}/api/resource${endpoint}`, {
    method,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ERPNext API error: ${response.status} - ${error}`);
  }
  
  return response.json();
}

export async function createCustomer(
  payload: CustomerPayload,
  config: ERPNextConfig
): Promise<{ id: string; type: string }> {
  const docType = payload.type === 'Lead' ? 'Lead' : 'Customer';
  
  const data = {
    leads_or_customer: payload.type,
    customer_name: payload.company || `${payload.firstName} ${payload.lastName}`,
    first_name: payload.firstName,
    last_name: payload.lastName,
    email_id: payload.email,
    phone: payload.phone,
    notes: payload.notes || '',
  };
  
  const result = await erpnextRequest(config, 'POST', `/${docType}`, data);
  return { id: result.data.name, type: docType };
}

export interface SalesOrderPayload {
  customerId: string;
  items: Array<{ itemCode: string; qty: number; rate: number }>;
  notes?: string;
}

export async function createSalesOrder(
  payload: SalesOrderPayload,
  config: ERPNextConfig
): Promise<{ id: string }> {
  const data = {
    customer: payload.customerId,
    items: payload.items.map((item) => ({
      item_code: item.itemCode,
      qty: item.qty,
      rate: item.rate,
    })),
    notes: payload.notes || '',
  };
  
  const result = await erpnextRequest(config, 'POST', '/Sales Order', data);
  return { id: result.data.name };
}
```

- [ ] **Step 4: Correr test, verificar que pasa**

```bash
cd ~/External/repos/codehub/codehub-ai-chat/api && npm test
# Expected: PASS
```

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(api): ERPNext service for customer and sales order creation"
```

---

## Task 5: Servicio Ollama — LLM Client

**Files:**
- Create: `api/src/services/ollama.ts`
- Create: `api/src/test/ollama.test.ts`

- [ ] **Step 1: Escribir test que falla**

```typescript
// api/src/test/ollama.test.ts
import { describe, it, expect, vi } from 'vitest';
import { chat } from '../services/ollama';

describe('Ollama Service', () => {
  it('should send chat request and receive response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: { content: 'Hello!' } }),
    });
    global.fetch = mockFetch;
    
    const response = await chat(
      [{ role: 'user', content: 'Hi' }],
      { baseUrl: 'http://localhost:11434' }
    );
    
    expect(response).toBe('Hello!');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/chat',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
```

- [ ] **Step 2: Correr test, verificar que falla**

```bash
cd ~/External/repos/codehub/codehub-ai-chat/api && npm test
# Expected: FAIL — chat not defined yet
```

- [ ] **Step 3: Implementar código mínimo**

```typescript
// api/src/services/ollama.ts

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaConfig {
  baseUrl: string;
  model?: string;
}

export async function chat(
  messages: Message[],
  config: OllamaConfig
): Promise<string> {
  const { baseUrl, model = 'mistral:7b-instruct-q4_0' } = config;
  
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.message?.content || '';
}
```

- [ ] **Step 4: Correr test, verificar que pasa**

```bash
cd ~/External/repos/codehub/codehub-ai-chat/api && npm test
# Expected: PASS
```

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(api): Ollama service for LLM chat"
```

---

## Task 6: Prompt Templates — Base Prompts Configurables

**Files:**
- Create: `api/src/lib/prompts.ts`

- [ ] **Step 1: Implementar sin test (configuración)**

```typescript
// api/src/lib/prompts.ts

export interface PromptConfig {
  systemPrompt: string;
  searchContextPrompt: string;
  comparisonPrompt: string;
  quotationPrompt: string;
}

export const DEFAULT_PROMPTS: PromptConfig = {
  systemPrompt: `Eres un asesor de ventas experto de CodeHub Store. Tu objetivo es ayudar a los clientes a encontrar el producto adecuado, comparar opciones y generar cotizaciones precisas.

REGLAS IMPORTANTES:
1. Solo sugiere productos que estén disponibles en stock.
2. Sé honesto sobre limitaciones de productos.
3. Nunca inventes información de productos — usa solo la información proporcionada en el contexto.
4. Responde en español de forma clara y amigable.
5. Si no tienes información sobre un producto, indica que consultarás la base de datos.`,

  searchContextPrompt: `Información de productos disponibles:

{products}

Basado en esta información, responde la consulta del cliente.`,

  comparisonPrompt: `Compara los siguientes productos para el cliente:

{products}

Destaca las diferencias clave en especificaciones, precio y disponibilidad.`,

  quotationPrompt: `Genera una cotización formal con los siguientes productos:

{products}

Incluye: nombre del cliente, productos, precios unitarios, cantidades, subtotal, y total.`,
};

export function buildSearchPrompt(query: string, products: any[]): Message[] {
  const context = products.length > 0
    ? DEFAULT_PROMPTS.searchContextPrompt.replace('{products}', JSON.stringify(products, null, 2))
    : 'No hay productos disponibles que coincidan con la búsqueda.';
  
  return [
    { role: 'system', content: DEFAULT_PROMPTS.systemPrompt },
    { role: 'user', content: `${context}\n\nConsulta del cliente: ${query}` },
  ];
}
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat(api): prompt templates library"
```

---

## Task 7: Routes — Chat y Products

**Files:**
- Create: `api/src/routes/chat.ts`
- Create: `api/src/routes/products.ts`

- [ ] **Step 1: Implementar chat route**

```typescript
// api/src/routes/chat.ts
import { Hono } from 'hono';
import { chat } from '../services/ollama';
import { buildSearchPrompt } from '../lib/prompts';
import { getPool, searchProducts } from '../services/mysql';

export const chatRoute = new Hono();

chatRoute.post('/', async (c) => {
  const { message, conversationHistory = [] } = await c.req.json();
  
  if (!message) {
    return c.json({ error: 'Message is required' }, 400);
  }
  
  // Get products for context
  const pool = getPool({
    host: c.env.MYSQL_HOST,
    user: c.env.MYSQL_USER,
    password: c.env.MYSQL_PASSWORD,
    database: c.env.MYSQL_DATABASE,
  });
  
  // Extract potential search terms from message
  const searchTerms = extractSearchTerms(message);
  let productsContext: any[] = [];
  
  if (searchTerms.length > 0) {
    for (const term of searchTerms.slice(0, 3)) {
      const products = await searchProducts(pool, term, 5);
      productsContext.push(...products);
    }
  }
  
  // Build messages with context
  const messages = buildSearchPrompt(message, productsContext);
  
  // Call Ollama
  const response = await chat(messages, {
    baseUrl: c.env.OLLAMA_HOST || 'http://localhost:11434',
  });
  
  return c.json({
    response,
    products: productsContext.slice(0, 5),
    // Save conversation for ERPNext lead creation later
    metadata: {
      timestamp: new Date().toISOString(),
      searchTerms,
    },
  });
});

function extractSearchTerms(message: string): string[] {
  // Simple extraction - could be enhanced with NLP
  const words = message.toLowerCase().split(/\s+/);
  const stopWords = ['el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'en', 'con', 'por', 'para', 'que', 'cual', 'cuanto', 'me', 'necesito', 'quiero', 'busco', 'tengo'];
  return words.filter(w => w.length > 3 && !stopWords.includes(w));
}
```

- [ ] **Step 2: Implementar products route**

```typescript
// api/src/routes/products.ts
import { Hono } from 'hono';
import { getPool, searchProducts } from '../services/mysql';

export const productsRoute = new Hono();

productsRoute.get('/search', async (c) => {
  const query = c.req.query('q') || '';
  const limit = parseInt(c.req.query('limit') || '20');
  
  if (!query) {
    return c.json({ error: 'Query parameter "q" is required' }, 400);
  }
  
  const pool = getPool({
    host: c.env.MYSQL_HOST,
    user: c.env.MYSQL_USER,
    password: c.env.MYSQL_PASSWORD,
    database: c.env.MYSQL_DATABASE,
  });
  
  const products = await searchProducts(pool, query, limit);
  
  return c.json({ products });
});
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat(api): chat and products routes"
```

---

## Task 8: WordPress Plugin — Admin Settings

**Files:**
- Create: `plugin/codehub-ai-advisor/codehub-ai-advisor.php`
- Create: `plugin/codehub-ai-advisor/includes/class-settings.php`

- [ ] **Step 1: Crear plugin principal**

```php
<?php
/**
 * Plugin Name: CodeHub AI Advisor
 * Description: AI chatbot advisor for WooCommerce product consultation.
 * Version: 0.1.0
 * Author: CodeHub
 * Requires Plugins: woocommerce
 */

if (!defined('ABSPATH')) {
    exit;
}

define('CH_AI_VERSION', '0.1.0');
define('CH_AI_PLUGIN_FILE', __FILE__);
define('CH_AI_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('CH_AI_PLUGIN_URL', plugin_dir_url(__FILE__));

require_once CH_AI_PLUGIN_DIR . 'includes/class-settings.php';
require_once CH_AI_PLUGIN_DIR . 'includes/class-api-client.php';
require_once CH_AI_PLUGIN_DIR . 'includes/class-widget.php';

add_action('plugins_loaded', function () {
    if (!class_exists('WooCommerce')) {
        add_action('admin_notices', function () {
            echo '<div class="notice notice-error"><p>CodeHub AI Advisor requiere WooCommerce activo.</p></div>';
        });
        return;
    }
    
    CH_AI_Settings::init();
    CH_AI_Widget::init();
});
```

- [ ] **Step 2: Crear class-settings.php**

```php
<?php
// includes/class-settings.php

class CH_AI_Settings {
    
    public static function init() {
        add_action('admin_menu', [self::class, 'addSettingsPage']);
        add_action('admin_init', [self::class, 'registerSettings']);
    }
    
    public static function addSettingsPage() {
        add_options_page(
            'CodeHub AI Advisor',
            'AI Advisor',
            'manage_options',
            'codehub-ai-advisor',
            [self::class, 'renderSettingsPage']
        );
    }
    
    public static function registerSettings() {
        register_setting('codehub_ai_advisor', 'ch_ai_api_url');
        register_setting('codehub_ai_advisor', 'ch_ai_api_key');
        register_setting('codehub_ai_advisor', 'ch_ai_system_prompt');
        register_setting('codehub_ai_advisor', 'ch_ai_erpnext_url');
        register_setting('codehub_ai_advisor', 'ch_ai_erpnext_api_key');
        register_setting('codehub_ai_advisor', 'ch_ai_erpnext_api_secret');
        
        add_settings_section(
            'ch_ai_main',
            'Configuración Principal',
            null,
            'codehub-ai-advisor'
        );
        
        add_settings_field('ch_ai_api_url', 'URL del API de Chat', function() {
            $value = get_option('ch_ai_api_url', 'https://ai.codehub.cl');
            echo "<input type='text' name='ch_ai_api_url' value='" . esc_attr($value) . "' class='regular-text' />";
            echo "<p class='description'>URL del servicio de chat (subdominio ai.codehub.cl)</p>";
        }, 'codehub-ai-advisor', 'ch_ai_main');
        
        add_settings_field('ch_ai_api_key', 'API Key', function() {
            $value = get_option('ch_ai_api_key', '');
            echo "<input type='password' name='ch_ai_api_key' value='" . esc_attr($value) . "' class='regular-text' />";
        }, 'codehub-ai-advisor', 'ch_ai_main');
        
        add_settings_field('ch_ai_system_prompt', 'Prompt del Sistema', function() {
            $value = get_option('ch_ai_system_prompt', '');
            echo "<textarea name='ch_ai_system_prompt' rows='5' class='large-text'>" . esc_textarea($value) . "</textarea>";
            echo "<p class='description'>Personaliza el comportamiento del asesor IA. Deja vacío para usar el default.</p>";
        }, 'codehub-ai-advisor', 'ch_ai_main');
        
        add_settings_section(
            'ch_ai_erpnext',
            'Configuración ERPNext',
            function() { echo '<p>Conecta con ERPNext para registrar leads y crear órdenes de venta automáticamente.</p>'; },
            'codehub-ai-advisor'
        );
        
        add_settings_field('ch_ai_erpnext_url', 'URL de ERPNext', function() {
            $value = get_option('ch_ai_erpnext_url', 'https://erp.codehub.cl');
            echo "<input type='text' name='ch_ai_erpnext_url' value='" . esc_attr($value) . "' class='regular-text' />";
        }, 'codehub-ai-advisor', 'ch_ai_erpnext');
        
        add_settings_field('ch_ai_erpnext_api_key', 'API Key', function() {
            $value = get_option('ch_ai_erpnext_api_key', '');
            echo "<input type='text' name='ch_ai_erpnext_api_key' value='" . esc_attr($value) . "' class='regular-text' />";
        }, 'codehub-ai-advisor', 'ch_ai_erpnext');
        
        add_settings_field('ch_ai_erpnext_api_secret', 'API Secret', function() {
            $value = get_option('ch_ai_erpnext_api_secret', '');
            echo "<input type='password' name='ch_ai_erpnext_api_secret' value='" . esc_attr($value) . "' class='regular-text' />";
        }, 'codehub-ai-advisor', 'ch_ai_erpnext');
    }
    
    public static function renderSettingsPage() {
        if (!current_user_can('manage_options')) {
            return;
        }
        ?>
        <div class="wrap">
            <h1>CodeHub AI Advisor</h1>
            <form method="post" action="options.php">
                <?php
                settings_fields('codehub_ai_advisor');
                do_settings_sections('codehub-ai-advisor');
                submit_button();
                ?>
            </form>
            
            <hr />
            <h2>Test de Conexión</h2>
            <button type="button" id="ch-ai-test-connection" class="button">Probar Conexión</button>
            <div id="ch-ai-test-result"></div>
            
            <script>
            jQuery('#ch-ai-test-connection').on('click', function() {
                var btn = jQuery(this);
                btn.prop('disabled', true).text('Probando...');
                
                jQuery.post(ajaxurl, {
                    action: 'ch_ai_test_connection',
                    api_url: jQuery('input[name="ch_ai_api_url"]').val(),
                    api_key: jQuery('input[name="ch_ai_api_key"]').val()
                }, function(resp) {
                    btn.prop('disabled', false).text('Probar Conexión');
                    jQuery('#ch-ai-test-result').html(
                        resp.success 
                            ? '<p style="color:green">✓ Conexión exitosa</p>' 
                            : '<p style="color:red">✗ Error: ' + resp.message + '</p>'
                    );
                });
            });
            </script>
        </div>
        <?php
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat(plugin): initial WordPress plugin structure with settings page"
```

---

## Task 9: WordPress Plugin — API Client y Widget

**Files:**
- Modify: `plugin/codehub-ai-advisor/includes/class-settings.php` (agregar AJAX handler)
- Create: `plugin/codehub-ai-advisor/includes/class-api-client.php`
- Create: `plugin/codehub-ai-advisor/includes/class-widget.php`

- [ ] **Step 1: Implementar class-api-client.php**

```php
<?php
// includes/class-api-client.php

class CH_AI_API_Client {
    
    private $apiUrl;
    private $apiKey;
    
    public function __construct() {
        $this->apiUrl = get_option('ch_ai_api_url', 'https://ai.codehub.cl');
        $this->apiKey = get_option('ch_ai_api_key', '');
    }
    
    public function chat($message, $history = []) {
        $response = wp_remote_post($this->apiUrl . '/chat', [
            'headers' => [
                'Authorization' => 'Bearer ' . $this->apiKey,
                'Content-Type' => 'application/json',
            ],
            'body' => json_encode([
                'message' => $message,
                'conversationHistory' => $history,
            ]),
            'timeout' => 30,
        ]);
        
        if (is_wp_error($response)) {
            throw new Exception($response->get_error_message());
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        return $data;
    }
    
    public function testConnection() {
        $response = wp_remote_get($this->apiUrl . '/health', [
            'headers' => [
                'Authorization' => 'Bearer ' . $this->apiKey,
            ],
            'timeout' => 10,
        ]);
        
        if (is_wp_error($response)) {
            return ['success' => false, 'message' => $response->get_error_message()];
        }
        
        $code = wp_remote_retrieve_response_code($response);
        return ['success' => $code === 200];
    }
}

// AJAX handler for connection test
add_action('wp_ajax_ch_ai_test_connection', function() {
    $client = new CH_AI_API_Client();
    $result = $client->testConnection();
    wp_send_json($result);
});
```

- [ ] **Step 2: Implementar class-widget.php (Frontend Chat Widget)**

```php
<?php
// includes/class-widget.php

class CH_AI_Widget {
    
    public static function init() {
        add_action('wp_enqueue_scripts', [self::class, 'enqueueAssets']);
        add_action('wp_footer', [self::class, 'renderWidget']);
        add_action('wp_ajax_ch_ai_send_message', [self::class, 'handleChatMessage']);
        add_action('wp_ajax_nopriv_ch_ai_send_message', [self::class, 'handleChatMessage']);
    }
    
    public static function enqueueAssets() {
        wp_enqueue_style(
            'ch-ai-widget',
            CH_AI_PLUGIN_URL . 'assets/css/widget.css',
            [],
            CH_AI_VERSION
        );
        
        wp_enqueue_script(
            'ch-ai-widget',
            CH_AI_PLUGIN_URL . 'assets/js/widget.js',
            ['jquery'],
            CH_AI_VERSION,
            true
        );
        
        wp_localize_script('ch-ai-widget', 'chAiConfig', [
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'apiUrl' => get_option('ch_ai_api_url', ''),
            'nonce' => wp_create_nonce('ch_ai_nonce'),
        ]);
    }
    
    public static function renderWidget() {
        ?>
        <div id="ch-ai-chat-widget" class="ch-ai-collapsed">
            <div class="ch-ai-header" onclick="toggleChAiWidget()">
                <span>💬 Asesor AI</span>
                <span class="ch-ai-toggle">▼</span>
            </div>
            <div class="ch-ai-body">
                <div class="ch-ai-messages" id="ch-ai-messages">
                    <div class="ch-ai-message ch-ai-bot">
                        Hola! Soy tu asesor de CodeHub. ¿En qué puedo ayudarte hoy?
                    </div>
                </div>
                <div class="ch-ai-input-area">
                    <input type="text" id="ch-ai-input" placeholder="Escribe tu pregunta..." />
                    <button onclick="sendChAiMessage()">Enviar</button>
                </div>
            </div>
        </div>
        <?php
    }
    
    public static function handleChatMessage() {
        check_ajax_referer('ch_ai_nonce', 'nonce');
        
        $message = sanitize_text_field($_POST['message'] ?? '');
        
        if (empty($message)) {
            wp_send_json_error(['message' => 'Message is required']);
        }
        
        $client = new CH_AI_API_Client();
        
        try {
            $result = $client->chat($message);
            wp_send_json_success($result);
        } catch (Exception $e) {
            wp_send_json_error(['message' => $e->getMessage()]);
        }
    }
}
```

- [ ] **Step 3: Crear assets del widget (CSS y JS)**

```css
/* assets/css/widget.css */
#ch-ai-chat-widget {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 350px;
    max-height: 500px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    z-index: 99999;
    display: flex;
    flex-direction: column;
    transition: all 0.3s ease;
}

#ch-ai-chat-widget.ch-ai-collapsed {
    height: 50px;
    overflow: hidden;
}

#ch-ai-chat-widget.ch-ai-expanded {
    height: 450px;
}

.ch-ai-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 12px 16px;
    border-radius: 12px 12px 0 0;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
}

.ch-ai-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.ch-ai-messages {
    flex: 1;
    padding: 16px;
    overflow-y: auto;
    background: #f8f9fa;
}

.ch-ai-message {
    padding: 10px 14px;
    border-radius: 12px;
    margin-bottom: 10px;
    max-width: 85%;
    line-height: 1.4;
}

.ch-ai-message.ch-ai-user {
    background: #667eea;
    color: white;
    margin-left: auto;
}

.ch-ai-message.ch-ai-bot {
    background: white;
    color: #333;
    border: 1px solid #e0e0e0;
}

.ch-ai-input-area {
    display: flex;
    padding: 12px;
    border-top: 1px solid #e0e0e0;
    background: white;
}

.ch-ai-input-area input {
    flex: 1;
    padding: 10px 14px;
    border: 1px solid #ddd;
    border-radius: 20px;
    outline: none;
    font-size: 14px;
}

.ch-ai-input-area input:focus {
    border-color: #667eea;
}

.ch-ai-input-area button {
    margin-left: 8px;
    padding: 10px 18px;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 20px;
    cursor: pointer;
    font-weight: 600;
}
```

```javascript
// assets/js/widget.js
function toggleChAiWidget() {
    const widget = document.getElementById('ch-ai-chat-widget');
    widget.classList.toggle('ch-ai-collapsed');
    widget.classList.toggle('ch-ai-expanded');
    
    const toggle = widget.querySelector('.ch-ai-toggle');
    toggle.textContent = widget.classList.contains('ch-ai-expanded') ? '▲' : '▼';
}

function sendChAiMessage() {
    const input = document.getElementById('ch-ai-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    appendMessage(message, 'user');
    input.value = '';
    
    jQuery.post(chAiConfig.ajaxUrl, {
        action: 'ch_ai_send_message',
        nonce: chAiConfig.nonce,
        message: message
    }, function(resp) {
        if (resp.success && resp.data.response) {
            appendMessage(resp.data.response, 'bot');
        } else {
            appendMessage('Lo siento, hubo un error. Por favor intenta de nuevo.', 'bot');
        }
    }).fail(function() {
        appendMessage('Lo siento, no pude conectarme al servidor.', 'bot');
    });
}

function appendMessage(text, sender) {
    const container = document.getElementById('ch-ai-messages');
    const div = document.createElement('div');
    div.className = 'ch-ai-message ch-ai-' + sender;
    div.textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

document.getElementById('ch-ai-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendChAiMessage();
    }
});
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat(plugin): API client and frontend chat widget"
```

---

## Task 10: Deployment — CapRover y Configuración

- [ ] **Step 1: Crear archivos de deployment**

```bash
# Dockerfile.multi que combina Ollama + API (optimizado para 7GB RAM)
cat > ~/External/repos/codehub/codehub-ai-chat/Dockerfile.caprover << 'EOF'
FROM ollama/ollama:latest
RUN ollama pull mistral:7b-instruct-q4_0
EXPOSE 11434
CMD ["serve"]
EOF
```

- [ ] **Step 2: Documentar deployment steps**

```bash
cat > ~/External/repos/codehub/codehub-ai-chat/DEPLOY.md << 'EOF'
# Deployment Guide

## Prerequisites
- CapRover running on codehub server
- Access to CapRover dashboard: http://codehub.cl:3000

## Steps

### 1. Build and Deploy Ollama Service
1. Connect to CapRover dashboard
2. Create new app: `codehub-ai-ollama`
3. Use Dockerfile method with `ollama/Dockerfile`
4. Set memory limit: 4GB
5. Deploy

### 2. Build and Deploy API Service
1. Create new app: `codehub-ai-api`
2. Use Dockerfile method with `api/Dockerfile`
3. Set memory limit: 1GB
4. Add environment variables:
   - `OLLAMA_HOST`: http://codehub-ai-ollama:11434
   - `MYSQL_HOST`: srv-captain--mysql-db
   - `MYSQL_USER`: wordpress
   - `MYSQL_PASSWORD`: <from CapRover secrets>
   - `MYSQL_DATABASE`: wordpress
   - `ERPNEXT_URL`: https://erp.codehub.cl
   - `ERPNEXT_API_KEY`: <from ERPNext settings>
   - `ERPNEXT_API_SECRET`: <from ERPNext settings>
   - `API_SECRET_KEY`: <generate random key>
5. Deploy

### 3. Configure Nginx for Subdomain
In CapRover, add custom domain: `ai.codehub.cl`

### 4. Install WordPress Plugin
1. Copy `plugin/codehub-ai-advisor` to WordPress plugins directory
2. Activate plugin in WordPress admin
3. Configure settings in Settings > AI Advisor
4. Test connection
EOF
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "docs: add deployment guide"
```

---

## Checklist de Calidad (Self-Review)

- [ ] **Spec coverage:** Cada requisito tiene un task asociado.
- [ ] **No placeholders:** No hay TBD, TODO, o código incompleto.
- [ ] **Consistencia:** Nombres coherentes en todos los archivos.
- [ ] **Tests:** Unit tests para servicios (Ollama, MySQL, ERPNext, Auth).
- [ ] **Docker:** docker-compose funcional para desarrollo local.
- [ ] **Plugin completo:** Settings page + API client + Widget frontend.
- [ ] **Commits frecuentes:** Cada task tiene su commit.

---

## Notas de Contexto

1. **Modelo elegido:** `mistral:7b-instruct-q4_0` — 4GB en 4-bit quantization, excelente para chats instructivos, corre en ~5GB RAM. Alternativa más ligera: `llama3.2:1b` (~700MB) si hay problemas de memoria.

2. **MySQL WooCommerce:** El schema de productos WooCommerce usa `wp_posts` con post_type='product' y `wp_postmeta` para campos como `_price`, `_stock`, `_sku`.

3. **ERPNext API:** Usa autenticación Basic Auth con API Key + Secret. Los endpoints principales: `POST /api/resource/Lead` y `POST /api/resource/Sales Order`.

4. **Plugin isolation:** Este es un plugin NUEVO separado del `codehub-tecnoglobal-manager`. No hay conflicto.

5. **Flujo de datos:**
   ```
   Cliente chat → Widget JS → WordPress AJAX → CH_AI_API_Client → 
   Chat API (Hono) → Ollama (Mistral) + MySQL (productos) →
   Respuesta → Widget
   ```
   
   **Lead creation:**
   ```
   Chat conversation → ERPNext Lead → (opcional) Sales Order
   ```
EOF
