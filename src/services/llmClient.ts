import { ChatOpenAI } from '@langchain/openai';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { HumanMessage, type BaseMessage } from '@langchain/core/messages';
import { HttpError } from '../middlewares/errorHandler.js';
import { getConfig } from '../config/env.js';
import { buildChatTools, type ChatToolContext } from './chatToolsService.js';

const HEALTH_CACHE_TTL_MS = 30_000;
let healthCache: { available: boolean; expiresAt: number } | null = null;

export const checkAgentHealth = async (): Promise<{ available: boolean }> => {
  const { openaiApiKey } = getConfig();
  if (!openaiApiKey) {
    return { available: false };
  }
  const now = Date.now();
  if (healthCache && now < healthCache.expiresAt) {
    return { available: healthCache.available };
  }
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${openaiApiKey}` },
      signal: AbortSignal.timeout(5000),
    });
    // 429 = rate-limited but the key is valid and the service is reachable
    const available = res.ok || res.status === 429;
    healthCache = { available, expiresAt: now + HEALTH_CACHE_TTL_MS };
    return { available };
  } catch {
    healthCache = { available: false, expiresAt: now + HEALTH_CACHE_TTL_MS };
    return { available: false };
  }
};

export interface RunAgentResult {
  readonly messages: BaseMessage[];
}

// Lazily constructs the chat model so config/env is read at call time, not import time.
const createModel = (): ChatOpenAI => {
  const { openaiApiKey, openaiModel } = getConfig();
  if (!openaiApiKey) {
    throw new HttpError('LLM service unavailable', 502, 'OPENAI_API_KEY is not configured');
  }
  return new ChatOpenAI({ apiKey: openaiApiKey, model: openaiModel, temperature: 0 });
};

const extractText = (content: unknown): string => {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((p) => (typeof p === 'string' ? p : typeof (p as { text?: string }).text === 'string' ? (p as { text: string }).text : ''))
      .join('');
  }
  return '';
};

/**
 * Calls the LLM to generate a concise chat session title from the user's first message.
 * Returns null on any failure so the caller can apply a fallback.
 */
export const generateSessionTitle = async (firstMessage: string): Promise<string | null> => {
  try {
    const model = createModel();
    const response = await model.invoke([
      new HumanMessage(
        `Generate a concise chat title (3–6 words, no quotes, no trailing punctuation) that captures the topic of this message:\n\n${firstMessage.slice(0, 500)}`,
      ),
    ]);
    const title = extractText(response.content).trim();
    return title.length > 0 ? title.slice(0, 100) : null;
  } catch {
    return null;
  }
};

/**
 * Runs the tool-calling ReAct agent over the supplied message history.
 * Returns the full message list (input + generated) from the agent run.
 */
export const runChatAgent = async (
  ctx: ChatToolContext,
  systemPrompt: string,
  messages: BaseMessage[],
): Promise<RunAgentResult> => {
  const { chatMaxToolIterations } = getConfig();
  try {
    const agent = createReactAgent({
      llm: createModel(),
      tools: buildChatTools(ctx),
      prompt: systemPrompt,
    });
    // recursionLimit bounds LLM<->tool round trips (roughly two graph steps per iteration).
    const result = await agent.invoke(
      { messages },
      { recursionLimit: chatMaxToolIterations * 2 + 1 },
    );
    return { messages: result.messages as BaseMessage[] };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    console.error('LLM agent invocation failed', error);
    throw new HttpError('LLM service unavailable', 502);
  }
};
