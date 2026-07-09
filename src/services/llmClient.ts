import { ChatOpenAI } from '@langchain/openai';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { HumanMessage, type BaseMessage } from '@langchain/core/messages';
import { HttpError } from '../middlewares/errorHandler.js';
import { getConfig } from '../config/env.js';
import { buildChatTools, type ChatToolContext, type ChatToolMode } from './chatToolsService.js';

export interface AgentToolRecord {
  readonly name: string;
  readonly toolCallId?: string;
  readonly content: string;
}

export interface AgentToolCall {
  readonly name: string;
  readonly args?: unknown;
  readonly id?: string;
  readonly type?: string;
}

export interface AgentStreamEvent {
  type: 'tool_start' | 'token' | 'done';
  toolName?: string;
  text?: string;
  // Emitted on 'done': the accumulated final answer + captured tool activity.
  assistantText?: string;
  toolRecords?: AgentToolRecord[];
  toolCalls?: AgentToolCall[];
}

const HEALTH_CACHE_TTL_MS = 30_000;
const HEALTH_BUSY_CACHE_TTL_MS = 90_000;

export const LLM_BUSY_USER_MESSAGE =
  'The AI service is currently busy (NVIDIA hosted models are queued). Please wait a moment and try again.';

export const LLM_UNAVAILABLE_USER_MESSAGE =
  'The AI assistant is temporarily unavailable. Please try again later.';

export type LlmHealthStatus = 'available' | 'busy' | 'unavailable';

export interface AgentHealthResult {
  readonly available: boolean;
  readonly status: LlmHealthStatus;
  readonly message?: string;
}

let healthCache: { result: AgentHealthResult; expiresAt: number } | null = null;
let llmBusyUntil: number | null = null;

interface ModelOverrides {
  readonly temperature?: number;
  readonly enableThinking?: boolean;
}

type LlmErrorKind = 'busy' | 'degraded' | 'unavailable';

interface ClassifiedLlmError {
  readonly kind: LlmErrorKind;
  readonly userMessage: string;
  readonly statusCode: number;
  readonly detail?: string;
}

const markLlmBusy = (durationMs = HEALTH_BUSY_CACHE_TTL_MS): void => {
  llmBusyUntil = Date.now() + durationMs;
  healthCache = {
    result: { available: false, status: 'busy', message: LLM_BUSY_USER_MESSAGE },
    expiresAt: Date.now() + durationMs,
  };
};

/** Extracts a human-readable detail string from LangChain / OpenAI SDK errors. */
const extractLlmErrorDetail = (error: unknown): string | undefined => {
  if (!error || typeof error !== 'object') {
    return undefined;
  }
  const err = error as Record<string, unknown>;
  if (typeof err.message === 'string' && err.message !== '400 status code (no body)') {
    return err.message;
  }
  const nested = err.error;
  if (nested && typeof nested === 'object') {
    const detail = (nested as { detail?: unknown; message?: unknown }).detail ?? (nested as { message?: unknown }).message;
    if (typeof detail === 'string') {
      return detail;
    }
  }
  return undefined;
};

const extractLlmHttpStatus = (error: unknown): number | undefined => {
  if (!error || typeof error !== 'object') {
    return undefined;
  }
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
};

const isBusyLlmDetail = (detail: string | undefined, httpStatus?: number): boolean => {
  if (httpStatus === 429 || httpStatus === 503) {
    return true;
  }
  if (!detail) {
    return false;
  }
  const lower = detail.toLowerCase();
  return (
    lower.includes('resourceexhausted') ||
    lower.includes('request limit reached') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('service unavailable') ||
    lower.includes('overloaded') ||
    lower.includes('capacity') ||
    lower.includes('queued')
  );
};

const classifyLlmError = (error: unknown): ClassifiedLlmError => {
  const detail = extractLlmErrorDetail(error);
  const httpStatus = extractLlmHttpStatus(error);

  if (isBusyLlmDetail(detail, httpStatus)) {
    return {
      kind: 'busy',
      userMessage: LLM_BUSY_USER_MESSAGE,
      statusCode: 503,
      ...(detail ? { detail } : {}),
    };
  }
  if (detail?.includes('DEGRADED')) {
    return {
      kind: 'degraded',
      userMessage:
        'The configured AI model is temporarily unavailable on NVIDIA. Please try again later or contact an administrator.',
      statusCode: 502,
      detail,
    };
  }
  return {
    kind: 'unavailable',
    userMessage: LLM_UNAVAILABLE_USER_MESSAGE,
    statusCode: 502,
    ...(detail ? { detail } : {}),
  };
};

const handleLlmError = (error: unknown, context: string): never => {
  if (error instanceof HttpError) {
    throw error;
  }
  const classified = classifyLlmError(error);
  console.error(`LLM ${context} failed`, classified.detail ?? error);
  if (classified.kind === 'busy') {
    markLlmBusy();
  }
  throw new HttpError(classified.userMessage, classified.statusCode, classified.detail);
};

/** Maps any LLM failure to a user-facing message (for stream fallbacks). */
export const toUserFacingLlmError = (error: unknown): HttpError => {
  if (error instanceof HttpError) {
    return error;
  }
  const classified = classifyLlmError(error);
  if (classified.kind === 'busy') {
    markLlmBusy();
  }
  return new HttpError(classified.userMessage, classified.statusCode, classified.detail);
};

const getActiveLlmCredentials = (): { apiKey: string; healthUrl: string } => {
  const config = getConfig();
  if (config.llmProvider === 'nvidia') {
    return {
      apiKey: config.nvidiaApiKey,
      healthUrl: `${config.nvidiaBaseUrl.replace(/\/$/, '')}/models`,
    };
  }
  return {
    apiKey: config.openaiApiKey,
    healthUrl: 'https://api.openai.com/v1/models',
  };
};

export const checkAgentHealth = async (): Promise<AgentHealthResult> => {
  const config = getConfig();
  const { apiKey, healthUrl } = getActiveLlmCredentials();
  if (!apiKey) {
    return { available: false, status: 'unavailable', message: LLM_UNAVAILABLE_USER_MESSAGE };
  }

  const now = Date.now();
  if (llmBusyUntil !== null && now < llmBusyUntil) {
    return { available: false, status: 'busy', message: LLM_BUSY_USER_MESSAGE };
  }
  if (healthCache && now < healthCache.expiresAt) {
    return healthCache.result;
  }

  try {
    if (config.llmProvider === 'nvidia') {
      // Lightweight reachability check — avoid completion probes on every poll (they consume quota).
      const res = await fetch(healthUrl, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      const result: AgentHealthResult =
        res.ok || res.status === 429
          ? { available: true, status: 'available' }
          : { available: false, status: 'unavailable', message: LLM_UNAVAILABLE_USER_MESSAGE };
      healthCache = { result, expiresAt: now + HEALTH_CACHE_TTL_MS };
      return result;
    }

    const res = await fetch(healthUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });
    const result: AgentHealthResult =
      res.ok || res.status === 429
        ? { available: true, status: 'available' }
        : { available: false, status: 'unavailable', message: LLM_UNAVAILABLE_USER_MESSAGE };
    healthCache = { result, expiresAt: now + HEALTH_CACHE_TTL_MS };
    return result;
  } catch {
    const result: AgentHealthResult = {
      available: false,
      status: 'unavailable',
      message: LLM_UNAVAILABLE_USER_MESSAGE,
    };
    healthCache = { result, expiresAt: now + HEALTH_CACHE_TTL_MS };
    return result;
  }
};

export interface RunAgentResult {
  readonly messages: BaseMessage[];
}

// Lazily constructs the chat model so config/env is read at call time, not import time.
const createModel = (overrides: ModelOverrides = {}): ChatOpenAI => {
  const config = getConfig();
  if (config.llmProvider === 'nvidia') {
    if (!config.nvidiaApiKey) {
      throw new HttpError('LLM service unavailable', 502, 'NVIDIA_API_KEY is not configured');
    }
    const enableThinking = overrides.enableThinking ?? config.nvidiaEnableThinking;
    return new ChatOpenAI({
      apiKey: config.nvidiaApiKey,
      model: config.nvidiaModel,
      temperature: overrides.temperature ?? config.nvidiaTemperature,
      topP: config.nvidiaTopP,
      maxTokens: config.nvidiaMaxTokens,
      configuration: { baseURL: config.nvidiaBaseUrl },
      modelKwargs: enableThinking
        ? {
            reasoning_budget: config.nvidiaReasoningBudget,
            chat_template_kwargs: { enable_thinking: true },
          }
        : {
            chat_template_kwargs: { enable_thinking: false },
          },
    });
  }

  if (!config.openaiApiKey) {
    throw new HttpError('LLM service unavailable', 502, 'OPENAI_API_KEY is not configured');
  }
  return new ChatOpenAI({
    apiKey: config.openaiApiKey,
    model: config.openaiModel,
    temperature: overrides.temperature ?? 0,
  });
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
    const model = createModel({ temperature: 0, enableThinking: false });
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
 * Streams tool calls and text tokens from the ReAct agent.
 * Yields tool_start events as tools are invoked, token events as text is generated,
 * and a final done event with the complete message list for persistence.
 */
export async function* streamChatAgent(
  ctx: ChatToolContext,
  systemPrompt: string,
  messages: BaseMessage[],
  toolMode: ChatToolMode = 'full',
): AsyncGenerator<AgentStreamEvent> {
  const { chatMaxToolIterations } = getConfig();
  const agent = createReactAgent({
    llm: createModel(),
    tools: buildChatTools(ctx, toolMode),
    prompt: systemPrompt,
  });

  // We reconstruct the final answer from the streamed tokens rather than from the
  // graph state: LangGraph stores the streamed turn as an AIMessageChunk (not an
  // AIMessage), so instanceof checks on the final state miss the assistant reply.
  let assistantText = '';
  const toolRecords: AgentToolRecord[] = [];
  const toolCalls: AgentToolCall[] = [];

  try {
    const eventStream = agent.streamEvents(
      { messages },
      { version: 'v2', recursionLimit: chatMaxToolIterations * 2 + 1 },
    );
    for await (const event of eventStream) {
      if (event.event === 'on_tool_start') {
        yield { type: 'tool_start', toolName: event.name };
      } else if (event.event === 'on_chat_model_stream') {
        const chunk = (event.data as { chunk?: { content?: unknown; additional_kwargs?: Record<string, unknown> } })?.chunk;
        // Nemotron reasoning traces arrive separately; only stream the final answer tokens.
        const content: unknown = chunk?.content;
        const text = extractText(content);
        if (text.length > 0) {
          assistantText += text;
          yield { type: 'token', text };
        }
      } else if (event.event === 'on_chat_model_end') {
        // Capture any tool_calls the model requested (for faithful DB persistence).
        const output = (event.data as { output?: { tool_calls?: AgentToolCall[] } } | undefined)?.output;
        if (Array.isArray(output?.tool_calls)) {
          for (const call of output!.tool_calls!) {
            if (call?.name) toolCalls.push(call);
          }
        }
      } else if (event.event === 'on_tool_end') {
        const output: unknown = (event.data as { output?: unknown } | undefined)?.output;
        let content: string;
        let toolCallId: string | undefined;
        if (output && typeof output === 'object' && 'tool_call_id' in output) {
          const msg = output as { content?: unknown; tool_call_id?: string };
          content = extractText(msg.content);
          toolCallId = msg.tool_call_id;
        } else {
          content = typeof output === 'string' ? output : JSON.stringify(output ?? null);
        }
        toolRecords.push(toolCallId ? { name: event.name, toolCallId, content } : { name: event.name, content });
      }
    }
  } catch (error) {
    handleLlmError(error, 'agent stream');
  }

  yield { type: 'done', assistantText, toolRecords, toolCalls };
}

/**
 * Runs the tool-calling ReAct agent over the supplied message history.
 * Returns the full message list (input + generated) from the agent run.
 */
export const runChatAgent = async (
  ctx: ChatToolContext,
  systemPrompt: string,
  messages: BaseMessage[],
  toolMode: ChatToolMode = 'full',
): Promise<RunAgentResult> => {
  const { chatMaxToolIterations } = getConfig();
  try {
    const agent = createReactAgent({
      llm: createModel(),
      tools: buildChatTools(ctx, toolMode),
      prompt: systemPrompt,
    });
    // recursionLimit bounds LLM<->tool round trips (roughly two graph steps per iteration).
    const result = await agent.invoke(
      { messages },
      { recursionLimit: chatMaxToolIterations * 2 + 1 },
    );
    return { messages: result.messages as BaseMessage[] };
  } catch (error) {
    return handleLlmError(error, 'agent invocation');
  }
};
