export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaConfig {
  baseUrl: string;
  model?: string;
}

export async function chat(
  baseUrl: string,
  messages: Message[],
  model: string,
  _systemPrompt?: string
): Promise<string> {
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
    const error = await response.text();
    throw new Error(`Ollama error ${response.status}: ${error}`);
  }

  const data = await response.json();
  return data.message?.content || '';
}

export async function checkOllamaHealth(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
}
