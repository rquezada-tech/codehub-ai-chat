import type { Message } from '../services/ollama';

export interface PromptConfig {
  systemPrompt: string;
}

export const DEFAULT_PROMPTS: Record<string, string> = {
  systemPrompt: `Eres un asesor de ventas experto de CodeHub Store. Tu objetivo es ayudar a los clientes a encontrar el producto adecuado, comparar opciones y generar cotizaciones precisas.

REGLAS IMPORTANTES:
1. Solo sugiere productos que estén disponibles en stock según la información proporcionada.
2. Sé honesto sobre limitaciones de productos — nunca exageres características.
3. Nunca inventes información de productos — usa solo la información proporcionada en el contexto.
4. Responde en español de forma clara, amigable y profesional.
5. Si no tienes información suficiente sobre un producto, indica que consultarás la base de datos.
6. Para cotizaciones, incluye precio, cantidad y total.
7. Si el cliente pregunta por algo fuera de tu alcance, redirige amablemente.
8. Never make up product specifications, prices, or availability. Only use data from the provided context.`,

  searchContext: `Información de productos disponibles en CodeHub Store:

{products}

Basándote en esta información, responde la consulta del cliente de forma útil y precisa.`,

  comparison: `Compara los siguientes productos para el cliente. Destaca diferencias en especificaciones, precio, disponibilidad y recomendaciones de uso:

{products}`,

  quotation: `Genera una cotización formal para CodeHub Store con los siguientes productos. Incluye: fecha, productos con precios unitarios, cantidades, subtotal e IVA (19% para Chile), y total:

{products}`,
};

export function buildSearchPrompt(query: string, products: any[], customSystemPrompt?: string): Message[] {
  const system = customSystemPrompt || DEFAULT_PROMPTS.systemPrompt;

  if (products.length > 0) {
    const productsJson = products.map(p =>
      `- ${p.title} | SKU: ${p.sku} | Precio: $${p.price?.toLocaleString('es-CL')} | Stock: ${p.stock} | Categoría: ${p.categories?.join(', ') || 'N/A'}\n  Descripción: ${p.description?.slice(0, 200)}...`
    ).join('\n\n');

    const context = DEFAULT_PROMPTS.searchContext.replace('{products}', productsJson);

    return [
      { role: 'system', content: system },
      { role: 'user', content: `${context}\n\n═══════════════════════════════════\nCONSULTA DEL CLIENTE:\n${query}\n═══════════════════════════════════` },
    ];
  }

  return [
    { role: 'system', content: system },
    { role: 'user', content: `No hay productos disponibles en este momento que coincidan con la búsqueda del cliente.\n\nConsulta del cliente: ${query}\n\nResponde amablemente indicando que no hay productos disponibles para su búsqueda y ofrece ayuda para encontrar alternativas.` },
  ];
}

export function buildComparisonPrompt(products: any[]): Message[] {
  return [
    { role: 'system', content: DEFAULT_PROMPTS.systemPrompt },
    { role: 'user', content: DEFAULT_PROMPTS.comparison.replace('{products}', JSON.stringify(products, null, 2)) },
  ];
}

export function buildQuotationPrompt(products: any[], customerName?: string): Message[] {
  const context = DEFAULT_PROMPTS.quotation.replace('{products}', JSON.stringify(products, null, 2));
  return [
    { role: 'system', content: DEFAULT_PROMPTS.systemPrompt },
    { role: 'user', content: `${context}\n\nCliente: ${customerName || 'Cliente'}` },
  ];
}
