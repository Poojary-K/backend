import { ChatOpenAI } from '@langchain/openai';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { HumanMessage, type BaseMessage } from '@langchain/core/messages';
import { HttpError } from '../middlewares/errorHandler.js';
import { getConfig } from '../config/env.js';
import { buildChatTools, type ChatToolContext } from './chatToolsService.js';

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
let healthCache: { available: boolean; expiresAt: number } | null = null;

interface ModelOverrides {
  readonly temperature?: number;
  readonly enableThinking?: boolean;
}

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

export const checkAgentHealth = async (): Promise<{ available: boolean }> => {
  const { apiKey, healthUrl } = getActiveLlmCredentials();
  if (!apiKey) {
    return { available: false };
  }
  const now = Date.now();
  if (healthCache && now < healthCache.expiresAt) {
    return { available: healthCache.available };
  }
  try {
    const res = await fetch(healthUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
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
): AsyncGenerator<AgentStreamEvent> {
  const { chatMaxToolIterations } = getConfig();
  const agent = createReactAgent({
    llm: createModel(),
    tools: buildChatTools(ctx),
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
    if (error instanceof HttpError) throw error;
    console.error('LLM agent stream failed', error);
    throw new HttpError('LLM service unavailable', 502);
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
