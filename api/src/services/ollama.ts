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
    const error = await response.text();
    throw new Error(`Ollama error ${response.status}: ${error}`);
  }

  const data = await response.json();
  return data.message?.content || '';
}

export async function checkOllamaHealth(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}
