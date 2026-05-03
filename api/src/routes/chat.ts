import { Hono } from 'hono';
import { chat as ollamaChat, checkOllamaHealth, type Message } from '../services/ollama';
import { getPool, searchProducts } from '../services/mysql';
import { buildSearchPrompt } from '../lib/prompts';

export const chatRoute = new Hono();

interface ChatRequest {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  systemPrompt?: string;
  ollamaModel?: string;
}

// POST /chat - Chat con IA
chatRoute.post('/', async (c) => {
  const { messages, systemPrompt, ollamaModel } = await c.req.json<ChatRequest>();

  const ollamaHost = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
  const model = ollamaModel || process.env.OLLAMA_MODEL || 'llama3.2:1b';

  try {
    const lastMessage = messages[messages.length - 1]?.content || '';
    let contextProducts: any[] = [];
    let enrichedMessages: Message[] = messages as Message[];

    if (lastMessage.match(/buscar|producto|precio|stock|tienen|hay|modelo|categor/i)) {
      try {
        const pool = getPool({
          host: process.env.MYSQL_HOST || 'srv-captain--mysql-db',
          user: process.env.MYSQL_USER || 'store',
          password: process.env.MYSQL_PASSWORD || 'StoreCodeHub2026!',
          database: process.env.MYSQL_DATABASE || 'store',
        });
        contextProducts = await searchProducts(pool, lastMessage);
        if (contextProducts.length > 0) {
          // buildSearchPrompt returns Message[] - prepend system msg, replace last user msg
          const searchMsgs = buildSearchPrompt(lastMessage, contextProducts, systemPrompt);
          enrichedMessages = [
            searchMsgs[0], // system
            ...messages.slice(0, -1) as Message[], // all but last user msg
            searchMsgs[1], // the enriched user msg from buildSearchPrompt
          ];
        }
      } catch (dbError) {
        console.error('DB error, proceeding without context:', dbError);
      }
    }

    const response = await ollamaChat(ollamaHost, enrichedMessages, model);
    return c.json({ response, contextProducts });
  } catch (error: any) {
    console.error('Ollama error:', error);
    return c.json({ error: error.message || 'Error communicating with AI' }, 500);
  }
});

// GET /chat/health
chatRoute.get('/health', async (c) => {
  const ollamaHost = process.env.OLLAMA_HOST || 'http://192.168.1.84:11434';
  const health = await checkOllamaHealth(ollamaHost);
  return c.json({ healthy: health });
});
