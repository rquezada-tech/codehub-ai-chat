# CodeHub AI Chat Advisor

Plugin de WooCommerce + API para chat de asesoría con IA local (Ollama/Mistral), integración con ERPNext CRM para registro de leads y órdenes de venta.

## Arquitectura

```
Cliente Web → WooCommerce Plugin → Chat API (Hono) → Ollama (Mistral 7B)
                                       ↓
                               MySQL WooCommerce (productos)
                                       ↓
                               ERPNext (leads/orders)
```

## Componentes

- **API (Hono.js):** `api/` — Serverless API en Node.js
- **Plugin (WordPress):** `plugin/codehub-ai-advisor/` — Plugin de WooCommerce
- **LLM (Ollama):** `ollama/` — Container con Mistral 7B Q4

## Requisitos

- Docker y Docker Compose
- Acceso a MySQL de WooCommerce (host: `srv-captain--mysql-db`)
- ERPNext corriendo en puerto 8088
- ~4GB RAM para Ollama

## Configuración Rápida

### 1. Variables de Entorno

```bash
export API_SECRET_KEY="tu-api-key-secreta-aqui"
```

### 2. Build y Start

```bash
cd ~/External/repos/codehub/codehub-ai-chat
docker-compose up -d
```

### 3. Verificar

```bash
curl http://localhost:3001/health
curl -X POST http://localhost:3001/chat \
  -H "X-API-Key: tu-api-key-secreta-aqui" \
  -H "Content-Type: application/json" \
  -d '{"message":"Qué productos tienen en oferta?"}'
```

## Desarrollo

```bash
cd api
npm install
npm run dev
```

## Plugin WordPress

Copiar `plugin/codehub-ai-advisor/` a:
```text
/var/www/html/wp-content/plugins/codehub-ai-advisor/
```

Luego activar desde el admin de WordPress y configurar en Settings > AI Advisor.

## API Endpoints

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/health` | No | Health check |
| POST | `/chat` | API Key | Chat con IA |
| GET | `/products/search?q=` | API Key | Buscar productos |
| GET | `/products/featured` | API Key | Productos destacados |
| POST | `/erpnext/login` | No | Login ERPNext |
| POST | `/erpnext/lead` | Cookie | Crear Lead |
| POST | `/erpnext/customer` | Cookie | Crear Cliente |
| POST | `/erpnext/sales-order` | Cookie | Crear Orden |

## CORS

Solo acepta requests desde:
- `codehub.cl`
- `*.codehub.cl` (cualquier subdominio)
- `localhost` (desarrollo)

## Modelo LLM

Por defecto usa `mistral:7b-instruct-q4_0` (~4GB). Alternativas más livianas:
- `llama3.2:1b-instruct-q4_0` (~700MB)
- `phi3:3.8b-mini-instruct-q4_0` (~2GB)

Cambiar en docker-compose.yml o variable `OLLAMA_MODEL`.

## Seguridad

- API Key obligatoria para endpoints protegidos
- Timing-safe comparison para evitar timing attacks
- CORS restrictivo por dominio
- Sanitización de inputs en todos los endpoints
- No almacenar passwords en texto plano (usar API keys)
