import { Hono } from 'hono';
import { chat as ollamaChat, checkOllamaHealth } from '../services/ollama';
import { getPool, searchProducts } from '../services/mysql';
import { buildSearchPrompt } from '../lib/prompts';
import { getWooConfig } from '../lib/config';
import type { Env } from '../index';

export const chatRoute = new Hono<{ Bindings: Env }>();

chatRoute.post('/', async (c) => {
  const { message, conversationHistory = [], systemPrompt } = await c.req.json();

  if (!message || typeof message !== 'string') {
    return c.json({ error: 'Message is required' }, 400);
  }

  const ollamaHost = c.env.OLLAMA_HOST || 'http://localhost:11434';

  // Check if Ollama is available
  const isOllamaUp = await checkOllamaHealth(ollamaHost);
  if (!isOllamaUp) {
    return c.json({
      error: 'AI service temporarily unavailable',
      details: 'Ollama server is not responding'
    }, 503);
  }

  try {
    // Get products for RAG context
    const wooConfig = getWooConfig(c.env);
    const pool = getPool(wooConfig);
    const searchTerms = extractSearchTerms(message);
    let productsContext: any[] = [];

    if (searchTerms.length > 0) {
      for (const term of searchTerms.slice(0, 3)) {
        const products = await searchProducts(pool, term, 5);
        productsContext.push(...products);
      }
    }

    // Deduplicate products
    const seen = new Set();
    productsContext = productsContext.filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    }).slice(0, 10);

    // Build messages with context
    const messages = buildSearchPrompt(message, productsContext, systemPrompt);

    // Call Ollama
    const response = await ollamaChat(messages, {
      baseUrl: ollamaHost,
      model: c.env.OLLAMA_MODEL || 'mistral:7b-instruct-q4_0',
    });

    return c.json({
      response,
      products: productsContext.slice(0, 5),
      metadata: {
        timestamp: new Date().toISOString(),
        searchTerms,
        productsFound: productsContext.length,
      },
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    return c.json({
      error: 'Failed to process chat',
      details: error.message,
    }, 500);
  }
});

// Get conversation context summary
chatRoute.get('/context', async (c) => {
  const sessionId = c.req.query('session_id');

  if (!sessionId) {
    return c.json({ error: 'session_id required' }, 400);
  }

  // In production, this would fetch from Redis or similar
  return c.json({
    sessionId,
    history: [],
    message: 'Context endpoint ready',
  });
});

function extractSearchTerms(text: string): string[] {
  const stopWords = new Set([
    'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'en', 'con', 'por', 'para',
    'que', 'cual', 'cuanto', 'me', 'necesito', 'quiero', 'busco', 'tengo',
    'como', 'donde', 'cuando', 'por', 'cada', 'todo', 'mas', 'muy', 'solo',
    'también', 'pero', 'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'eso',
    'hace', 'ser', 'estar', 'hay', 'tan', 'sido', 'sido', 'fue', 'son'
  ]);

  const words = text.toLowerCase()
    .replace(/[^\w\sáéíóúñ]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w));

  return [...new Set(words)];
}
