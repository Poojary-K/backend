import { expireStalePendingForSession, findActivePendingBySessionId, listRecentlyExecutedBySessionId, listRecentlySupersededBySessionId } from '../repositories/chatPendingRepository.js';
import { getPendingTask } from './chatPendingService.js';

const WRITE_QUEUE_CLAIM_RE =
  /\b(?:queued|awaiting confirmation|pending task|has been proposed|queued for confirmation|proposal has been)\b/i;

/** Matches confirm-API phrasing that the LLM must never emit itself. */
const LLM_FORBIDDEN_COMPLETION_RE =
  /^Done\.\s|(?:\brecorded successfully\b|\bhas been applied successfully\b)/i;

const WRITE_INTENT_RE =
  /\b(?:add|create|make|record|enter|insert|update|change|modify|edit|delete|remove|promote|queue|contribution|donation|disbursement|cause)\b/i;

const WRITE_STATUS_RE =
  /\b(?:all done|everything done|what(?:'s| is| are).*pending|did it work|is it done|any pending|still waiting|status of|did something go wrong|went wrong|what happened)\b/i;

const PROPOSE_TOOL_PREFIX = 'propose_';
const PENDING_MUTATING_TOOLS = new Set(['update_pending_task']);

export const isWriteIntentUserMessage = (content: string): boolean => WRITE_INTENT_RE.test(content);

export const isWriteStatusUserMessage = (content: string): boolean => WRITE_STATUS_RE.test(content);

/**
 * Removes LLM impersonation of post-confirm success messages (only the UI confirm API may say "Done.").
 */
export const stripLlmCompletionClaims = (content: string): string => {
  const trimmed = content.trim();
  if (!trimmed) {
    return content;
  }
  if (LLM_FORBIDDEN_COMPLETION_RE.test(trimmed)) {
    return '';
  }
  return content
    .split('\n')
    .filter((line) => !LLM_FORBIDDEN_COMPLETION_RE.test(line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const formatExecutedLine = (summary: string, result: unknown): string => {
  if (result && typeof result === 'object') {
    const record = result as Record<string, unknown>;
    if (typeof record.contributionId === 'number') {
      return `- ${summary} → contribution #${record.contributionId}`;
    }
    if (typeof record.causeId === 'number') {
      return `- ${summary} → cause #${record.causeId}`;
    }
  }
  return `- ${summary}`;
};

/**
 * Builds a DB-grounded summary of pending / applied / skipped write actions for this chat session.
 */
export const buildSessionWriteStatusSummary = async (sessionId: number, isAdmin: boolean): Promise<string> => {
  if (!isAdmin) {
    return 'Only administrators can queue or confirm changes via chat.';
  }

  await expireStalePendingForSession(sessionId);
  const active = await findActivePendingBySessionId(sessionId);
  const executed = await listRecentlyExecutedBySessionId(sessionId, 5);
  const superseded = await listRecentlySupersededBySessionId(sessionId, 5);

  const lines: string[] = [];

  if (active) {
    lines.push(`**Awaiting your confirmation:** ${active.summary}`);
    lines.push('Use the **Yes** or **No** buttons below my last message.');
  } else {
    lines.push('**Nothing is waiting for confirmation in this chat right now.**');
  }

  if (executed.length > 0) {
    lines.push('', '**Applied in this chat (after you clicked Yes):**');
    for (const row of executed) {
      lines.push(formatExecutedLine(row.summary, row.result));
    }
  }

  const executedIds = new Set(executed.map((row) => row.pending_id));
  const skipped = superseded.filter((row) => !executedIds.has(row.pending_id));
  if (skipped.length > 0) {
    lines.push('', '**Not applied (replaced by a newer proposal before you confirmed):**');
    for (const row of skipped.slice(0, 5)) {
      lines.push(`- ${row.summary}`);
    }
  }

  if (!active && executed.length === 0 && skipped.length === 0) {
    lines.push('', 'No write proposals have been registered in this chat yet.');
  } else if (!active && executed.length > 0) {
    lines.push('', 'If you need more entries, ask me to queue the next one — only one proposal is held at a time.');
  }

  return lines.join('\n');
};

const HONEST_QUEUE_FAILURE =
  'I was unable to register that change for confirmation — nothing is queued yet. Please try again with the member or record ID and exact changes.';

export interface WriteHonestyInput {
  readonly content: string;
  readonly userContent: string;
  readonly toolsUsed: readonly string[];
  readonly sessionId: number;
  readonly isAdmin: boolean;
}

/**
 * Validates and corrects assistant replies about writes: blocks fake "Done" messages,
 * grounds status questions in DB state, and catches false queue claims on write requests.
 */
export const enforceAssistantWriteHonesty = async (input: WriteHonestyInput): Promise<string> => {
  const { userContent, toolsUsed, sessionId, isAdmin } = input;
  let content = stripLlmCompletionClaims(input.content);

  if (!isAdmin) {
    return content;
  }

  if (isWriteStatusUserMessage(userContent)) {
    return buildSessionWriteStatusSummary(sessionId, isAdmin);
  }

  const claimsQueue = WRITE_QUEUE_CLAIM_RE.test(content);
  if (!claimsQueue && !content.trim()) {
    return content;
  }

  const calledPropose = toolsUsed.some((name) => name.startsWith(PROPOSE_TOOL_PREFIX));
  const calledPendingUpdate = toolsUsed.some((name) => PENDING_MUTATING_TOOLS.has(name));
  const activePending = await getPendingTask(sessionId, isAdmin);

  if (claimsQueue) {
    const writeIntent = isWriteIntentUserMessage(userContent);
    if (writeIntent && !calledPropose && !calledPendingUpdate) {
      return HONEST_QUEUE_FAILURE;
    }
    if (writeIntent && (calledPropose || calledPendingUpdate) && !activePending) {
      return HONEST_QUEUE_FAILURE;
    }
    if (!writeIntent && !activePending) {
      content = content
        .split('\n')
        .filter((line) => !WRITE_QUEUE_CLAIM_RE.test(line))
        .join('\n')
        .trim();
    }
  }

  if (!content.trim() && (calledPropose || calledPendingUpdate) && activePending) {
    return `Ready for your confirmation: **${activePending.summary}**. Use the **Yes** or **No** buttons below.`;
  }

  return content;
};
