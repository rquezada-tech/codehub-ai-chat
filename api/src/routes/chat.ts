import { Hono } from 'hono';
import { chat as ollamaChat, checkOllamaHealth } from '../services/ollama';
import { getPool, searchProducts } from '../services/mysql';
import { buildSearchPrompt } from '../lib/prompts';
import type { Env } from '../index';

export const chatRoute = new Hono<{ Bindings: Env }>();

// POST /chat - Chat con IA
chatRoute.post('/', async (c) => {
  const { messages, systemPrompt, ollamaModel } = await c.req.json<{
    messages: Array<{ role: string; content: string }>;
    systemPrompt?: string;
    ollamaModel?: string;
  }>();

  const env = c.env as Env;
  const ollamaHost = env.OLLAMA_HOST || 'http://ollama:11434';
  const model = ollamaModel || env.OLLAMA_MODEL || 'mistral:7b-instruct-q4_0';

  try {
    // Si el mensaje menciona búsqueda de productos, enriquecemos con contexto
    const lastMessage = messages[messages.length - 1]?.content || '';
    let contextProducts: any[] = [];
    let enrichedMessages = messages;

    if (lastMessage.match(/buscar|producto|precio|stock|tienen|hay|modelo|categor/i)) {
      try {
        const pool = getPool({
          host: env.MYSQL_HOST || 'srv-captain--mysql-db',
          user: env.MYSQL_USER || 'store',
          password: env.MYSQL_PASSWORD || 'StoreCodeHub2026!',
          database: env.MYSQL_DATABASE || 'store',
        });
        contextProducts = await searchProducts(pool, lastMessage);
        if (contextProducts.length > 0) {
          const prompt = buildSearchPrompt(lastMessage, contextProducts);
          enrichedMessages = [
            ...messages.slice(0, -1),
            { role: 'user', content: prompt },
          ];
        }
      } catch (dbError) {
        console.error('DB error, proceeding without context:', dbError);
      }
    }

    const response = await ollamaChat(
      ollamaHost,
      enrichedMessages,
      model,
      systemPrompt
    );

    return c.json({ response, contextProducts });
  } catch (error: any) {
    console.error('Ollama error:', error);
    return c.json({ error: error.message || 'Error communicating with AI' }, 500);
  }
});

// GET /chat/health - Verificar estado de Ollama
chatRoute.get('/health', async (c) => {
  const env = c.env as Env;
  const ollamaHost = env.OLLAMA_HOST || 'http://ollama:11434';
  const health = await checkOllamaHealth(ollamaHost);
  return c.json(health);
});
