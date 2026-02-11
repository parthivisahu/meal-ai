import dotenv from 'dotenv';
import Groq from 'groq-sdk';

dotenv.config();

const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';

const getProvider = () => {
  if (process.env.LLM_PROVIDER) return process.env.LLM_PROVIDER.toLowerCase();
  if (process.env.OLLAMA_BASE_URL || process.env.OLLAMA_MODEL || process.env.OLLAMA_MEAL_MODEL) {
    return 'ollama';
  }
  return 'groq';
};

const getModel = (task, provider) => {
  const isMeal = task === 'meal';

  if (provider === 'ollama') {
    if (isMeal) {
      return (
        process.env.OLLAMA_MEAL_MODEL ||
        process.env.MEAL_MODEL ||
        process.env.OLLAMA_MODEL ||
        'llama3.1:8b'
      );
    }
    return (
      process.env.OLLAMA_MATCH_MODEL ||
      process.env.MATCH_MODEL ||
      process.env.OLLAMA_MODEL ||
      'llama3.1:8b'
    );
  }

  if (isMeal) {
    return process.env.MEAL_MODEL || 'llama-3.3-70b-versatile';
  }
  return process.env.MATCH_MODEL || 'llama-3.1-8b-instant';
};

const getGroqClient = () => {
  if (!process.env.GROQ_API_KEY) return null;
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
};

const callOllama = async ({ model, messages, format }) => {
  if (typeof fetch !== 'function') {
    throw new Error('Fetch API not available. Use Node 18+ or add a fetch polyfill.');
  }
  const baseUrl = process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL;
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      ...(format ? { format } : {})
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ollama error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data?.message?.content || '';
};

const tryParseJson = (text) => {
  if (!text || typeof text !== 'string') return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const extractJsonObject = (text) => {
  if (!text || typeof text !== 'string') return null;
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) return null;
  const slice = text.slice(first, last + 1);
  return tryParseJson(slice);
};

export const chatJson = async ({ messages, task = 'meal', temperature = 0.7, maxTokens = 8000 }) => {
  const provider = getProvider();
  const model = getModel(task, provider);

  if (provider === 'ollama') {
    const content = await callOllama({ model, messages, format: 'json' });
    return tryParseJson(content) || extractJsonObject(content);
  }

  const groq = getGroqClient();
  if (!groq) {
    throw new Error('No Groq API key set and Ollama not configured.');
  }

  const response = await groq.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' }
  });

  const content = response?.choices?.[0]?.message?.content || '';
  return tryParseJson(content) || extractJsonObject(content);
};

export const chatText = async ({ messages, task = 'match', temperature = 0, maxTokens = 100 }) => {
  const provider = getProvider();
  const model = getModel(task, provider);

  if (provider === 'ollama') {
    return callOllama({ model, messages });
  }

  const groq = getGroqClient();
  if (!groq) {
    throw new Error('No Groq API key set and Ollama not configured.');
  }

  const response = await groq.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens
  });

  return response?.choices?.[0]?.message?.content || '';
};
