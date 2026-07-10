import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import type { DynamicStructuredTool } from '@langchain/core/tools';
import { HttpError } from '../middlewares/errorHandler.js';
import * as readService from './chatReadService.js';
import * as pendingService from './chatPendingService.js';

export interface ChatToolContext {
  readonly memberId: number;
  readonly isAdmin: boolean;
  readonly sessionId?: number;
}

type ToolAccess = 'member' | 'admin';
type ToolCategory = 'read' | 'propose' | 'pending';

interface ChatToolDefinition {
  readonly name: string;
  readonly label: string;
  readonly description: string;
  readonly schema: z.ZodObject<z.ZodRawShape>;
  readonly access: ToolAccess;
  readonly category: ToolCategory;
  readonly execute: (args: Record<string, unknown>, ctx: ChatToolContext) => Promise<unknown>;
}

const TOOL_RESULT_MAX_CHARS = 8000;

// Parses an optional YYYY-MM-DD string into a Date, ignoring invalid values.
const parseDate = (value: unknown): Date | undefined => {
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }
  const parsed = new Date(value.trim());
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const dateRangeShape = {
  fromDate: z.string().optional().describe('Filter from this date (YYYY-MM-DD)'),
  toDate: z.string().optional().describe('Filter to this date (YYYY-MM-DD)'),
};

const limitShape = {
  limit: z.number().int().min(1).max(100).optional().describe('Max results (default 20)'),
};

/**
 * Read-only tool catalog. Each entry maps an LLM-callable tool to a chatReadService method.
 */
const TOOL_DEFINITIONS: ChatToolDefinition[] = [
  // ---- Tier A: all authenticated members ----
  {
    name: 'get_fund_status',
    label: 'Checking fund balance',
    description: 'Returns total contributions, total disbursements (causes), and available fund balance.',
    schema: z.object({}),
    access: 'member',
    category: 'read',
    execute: () => readService.getFundStatus(),
  },
  {
    name: 'get_current_date_ist',
    label: 'Checking today\'s date',
    description:
      'Returns the current date and time in Indian Standard Time (IST / Asia/Kolkata). ' +
      'CALL THIS when the user gives a date without a year (e.g. "August 1", "july 10") before queueing contributions or causes — use the returned year to build YYYY-MM-DD.',
    schema: z.object({}),
    access: 'member',
    category: 'read',
    execute: async () => readService.getCurrentDateIst(),
  },
  {
    name: 'list_causes',
    label: 'Listing causes',
    description: 'Lists fundraising causes / disbursements, newest first. Optional date range filter.',
    schema: z.object({ ...limitShape, ...dateRangeShape }),
    access: 'member',
    category: 'read',
    execute: (args) =>
      readService.listCauses({
        limit: args.limit as number | undefined,
        fromDate: parseDate(args.fromDate),
        toDate: parseDate(args.toDate),
      }),
  },
  {
    name: 'get_cause',
    label: 'Looking up cause',
    description: 'Get a single fundraising cause by its ID.',
    schema: z.object({ causeId: z.number().int().describe('Cause ID') }),
    access: 'member',
    category: 'read',
    execute: (args) => readService.getCause(args.causeId as number),
  },
  {
    name: 'search_causes',
    label: 'Searching causes',
    description: 'Search causes by keyword in title or description.',
    schema: z.object({ query: z.string().min(1), ...limitShape }),
    access: 'member',
    category: 'read',
    execute: (args) => readService.searchCauses(args.query as string, args.limit as number | undefined),
  },
  {
    name: 'list_cause_images',
    label: 'Loading cause images',
    description: 'List proof-of-payment image URLs for a cause.',
    schema: z.object({ causeId: z.number().int() }),
    access: 'member',
    category: 'read',
    execute: (args) => readService.listCauseImages(args.causeId as number),
  },
  // ---- Tier B: member-scoped ----
  {
    name: 'get_my_profile',
    label: 'Loading your profile',
    description: "Returns the current user's profile (name, join date, admin status). No password or verification data.",
    schema: z.object({}),
    access: 'member',
    category: 'read',
    execute: (_args, ctx) => readService.getMyProfile(ctx.memberId),
  },
  {
    name: 'list_my_contributions',
    label: 'Loading your contributions',
    description: 'Lists contributions made by the current user, optionally filtered by date range.',
    schema: z.object({ ...limitShape, ...dateRangeShape }),
    access: 'member',
    category: 'read',
    execute: (args, ctx) =>
      readService.listMyContributions(ctx.memberId, {
        limit: args.limit as number | undefined,
        fromDate: parseDate(args.fromDate),
        toDate: parseDate(args.toDate),
      }),
  },
  {
    name: 'get_my_contribution_total',
    label: 'Calculating your total',
    description: 'Returns the total amount the current user has contributed.',
    schema: z.object({}),
    access: 'member',
    category: 'read',
    execute: (_args, ctx) => readService.getMyContributionTotal(ctx.memberId),
  },
  {
    name: 'get_my_contribution',
    label: 'Looking up contribution',
    description: 'Get a single contribution by ID if it belongs to the current user.',
    schema: z.object({ contributionId: z.number().int() }),
    access: 'member',
    category: 'read',
    execute: (args, ctx) => readService.getMyContribution(ctx.memberId, args.contributionId as number),
  },
  // ---- Tier C: admin only ----
  {
    name: 'list_members',
    label: 'Loading member list',
    description: 'List all registered members (sanitized, no passwords).',
    schema: z.object({ ...limitShape }),
    access: 'admin',
    category: 'read',
    execute: (args) => readService.listMembers(args.limit as number | undefined),
  },
  {
    name: 'get_member',
    label: 'Looking up member',
    description: 'Get a member by ID.',
    schema: z.object({ memberId: z.number().int() }),
    access: 'admin',
    category: 'read',
    execute: (args) => readService.getMember(args.memberId as number),
  },
  {
    name: 'search_members',
    label: 'Searching members',
    description:
      'Search members by name or email substring. USE BEFORE propose_create_contribution to resolve memberId. Returns memberId, name, email for each match.',
    schema: z.object({ query: z.string().min(1), ...limitShape }),
    access: 'admin',
    category: 'read',
    execute: (args) => readService.searchMembers(args.query as string, args.limit as number | undefined),
  },
  {
    name: 'list_contributions',
    label: 'Loading all contributions',
    description: 'List all contributions across members with member names. Optional member and date filters.',
    schema: z.object({
      ...limitShape,
      memberId: z.number().int().optional().describe('Optional filter by member'),
      ...dateRangeShape,
    }),
    access: 'admin',
    category: 'read',
    execute: (args) =>
      readService.listContributions({
        limit: args.limit as number | undefined,
        memberId: args.memberId as number | undefined,
        fromDate: parseDate(args.fromDate),
        toDate: parseDate(args.toDate),
      }),
  },
  {
    name: 'get_contribution',
    label: 'Looking up contribution',
    description: 'Get any contribution by ID with the member name (admin).',
    schema: z.object({ contributionId: z.number().int() }),
    access: 'admin',
    category: 'read',
    execute: (args) => readService.getContribution(args.contributionId as number),
  },
  {
    name: 'list_contribution_images',
    label: 'Loading contribution images',
    description: 'List proof images for any contribution (admin).',
    schema: z.object({ contributionId: z.number().int() }),
    access: 'admin',
    category: 'read',
    execute: (args) => readService.listContributionImages(args.contributionId as number),
  },
  {
    name: 'get_contribution_summary',
    label: 'Summarising contributions',
    description: 'Aggregate contribution statistics: total amount, count, and top contributors. Optional date range.',
    schema: z.object({ ...dateRangeShape }),
    access: 'admin',
    category: 'read',
    execute: (args) =>
      readService.getContributionSummary({ fromDate: parseDate(args.fromDate), toDate: parseDate(args.toDate) }),
  },
  {
    name: 'get_cause_summary',
    label: 'Summarising causes',
    description: 'Aggregate cause/disbursement statistics: total amount spent and count. Optional date range.',
    schema: z.object({ ...dateRangeShape }),
    access: 'admin',
    category: 'read',
    execute: (args) =>
      readService.getCauseSummary({ fromDate: parseDate(args.fromDate), toDate: parseDate(args.toDate) }),
  },
  // ---- Tier D: admin pending/propose tools (no direct DB writes) ----
  {
    name: 'propose_create_contribution',
    label: 'Drafting contribution',
    description:
      'USE THIS to queue a NEW member contribution (money received). Does NOT save to the database yet — creates a pending task the admin confirms in the UI. ' +
      'Required workflow: (1) search_members to obtain memberId, (2) get_current_date_ist if the user omitted the year, (3) call with memberId, amount (>0), contributedDate as YYYY-MM-DD. ' +
      'Returns JSON with pending.pendingId and pending.summary on success. Only tell the user a pending task exists if pendingId is present in the tool response.',
    schema: z.object({
      memberId: z.number().int().positive(),
      amount: z.number().positive(),
      contributedDate: z.string().describe('Date of contribution (YYYY-MM-DD)'),
    }),
    access: 'admin',
    category: 'propose',
    execute: (args, ctx) =>
      pendingService.proposeCreateContribution(ctx.sessionId, ctx.memberId, ctx.isAdmin, args),
  },
  {
    name: 'propose_update_contribution',
    label: 'Drafting contribution update',
    description:
      'USE THIS to queue an EDIT to an existing contribution. Requires contributionId from get_contribution or list_contributions. ' +
      'Optionally change memberId, amount, or contributedDate. Creates a UI-confirmed pending task — not an immediate save. ' +
      'Verify pending.pendingId in the tool response before telling the user it was queued.',
    schema: z.object({
      contributionId: z.number().int().positive(),
      memberId: z.number().int().positive().optional(),
      amount: z.number().positive().optional(),
      contributedDate: z.string().optional().describe('New date (YYYY-MM-DD)'),
    }),
    access: 'admin',
    category: 'propose',
    execute: (args, ctx) =>
      pendingService.proposeUpdateContribution(ctx.sessionId, ctx.memberId, ctx.isAdmin, args),
  },
  {
    name: 'propose_delete_contribution',
    label: 'Drafting contribution deletion',
    description:
      'USE THIS to queue DELETION of a contribution by contributionId. Requires the ID from get_contribution or list_contributions. ' +
      'Creates a pending task for UI confirmation — does not delete immediately. Check tool response for pending.pendingId.',
    schema: z.object({ contributionId: z.number().int().positive() }),
    access: 'admin',
    category: 'propose',
    execute: (args, ctx) =>
      pendingService.proposeDeleteContribution(ctx.sessionId, ctx.memberId, ctx.isAdmin, args),
  },
  {
    name: 'propose_create_cause',
    label: 'Drafting cause',
    description:
      'USE THIS to queue a NEW cause/disbursement (money spent from the fund). Requires title; amount and description optional. ' +
      'If amount is set, call check_disbursement_feasibility first. Creates a UI-confirmed pending task. ' +
      'Only confirm success to the user if the tool returns pending.pendingId.',
    schema: z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      amount: z.number().nonnegative().optional(),
      createdat: z.string().optional().describe('Date (YYYY-MM-DD)'),
    }),
    access: 'admin',
    category: 'propose',
    execute: (args, ctx) => pendingService.proposeCreateCause(ctx.sessionId, ctx.memberId, ctx.isAdmin, args),
  },
  {
    name: 'propose_update_cause',
    label: 'Drafting cause update',
    description:
      'USE THIS to queue an EDIT to an existing cause. Requires causeId from get_cause or list_causes. ' +
      'Creates a pending task for UI confirmation. Verify pending.pendingId in the response.',
    schema: z.object({
      causeId: z.number().int().positive(),
      title: z.string().min(1).optional(),
      description: z.string().optional(),
      amount: z.number().nonnegative().optional(),
      createdat: z.string().optional(),
    }),
    access: 'admin',
    category: 'propose',
    execute: (args, ctx) => pendingService.proposeUpdateCause(ctx.sessionId, ctx.memberId, ctx.isAdmin, args),
  },
  {
    name: 'propose_delete_cause',
    label: 'Drafting cause deletion',
    description:
      'USE THIS to queue DELETION of a cause by causeId. Creates a pending task for UI confirmation — not an immediate delete.',
    schema: z.object({ causeId: z.number().int().positive() }),
    access: 'admin',
    category: 'propose',
    execute: (args, ctx) => pendingService.proposeDeleteCause(ctx.sessionId, ctx.memberId, ctx.isAdmin, args),
  },
  {
    name: 'propose_update_member',
    label: 'Drafting member update',
    description:
      'USE THIS to queue a member profile change (name, email, or phone). Requires memberId from get_member or search_members. UI confirmation required.',
    schema: z.object({
      memberId: z.number().int().positive(),
      name: z.string().min(1).optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
    }),
    access: 'admin',
    category: 'propose',
    execute: (args, ctx) => pendingService.proposeUpdateMember(ctx.sessionId, ctx.memberId, ctx.isAdmin, args),
  },
  {
    name: 'propose_promote_member',
    label: 'Drafting admin promotion',
    description:
      'USE THIS to queue promoting a member to admin. Requires memberId. Creates a pending task — does not promote immediately.',
    schema: z.object({ memberId: z.number().int().positive() }),
    access: 'admin',
    category: 'propose',
    execute: (args, ctx) => pendingService.proposePromoteMember(ctx.sessionId, ctx.memberId, ctx.isAdmin, args),
  },
  {
    name: 'propose_delete_member',
    label: 'Drafting member deletion',
    description:
      'USE THIS to queue removing a member from the society. Requires memberId. Creates a pending task for UI confirmation.',
    schema: z.object({ memberId: z.number().int().positive() }),
    access: 'admin',
    category: 'propose',
    execute: (args, ctx) => pendingService.proposeDeleteMember(ctx.sessionId, ctx.memberId, ctx.isAdmin, args),
  },
  {
    name: 'get_pending_task',
    label: 'Checking pending action',
    description:
      'Returns the active pending task for this chat session, if any. Use when unsure whether a proposal is queued or to read the current summary before replying.',
    schema: z.object({}),
    access: 'admin',
    category: 'pending',
    execute: (_args, ctx) => pendingService.getPendingTask(ctx.sessionId, ctx.isAdmin),
  },
  {
    name: 'update_pending_task',
    label: 'Updating pending action',
    description:
      'Edits the active pending task payload (e.g. change amount, member, title) and regenerates its summary. ' +
      'Use when the admin asks to modify the queued action before clicking Confirm in the UI. Requires an active pending task.',
    schema: z.object({
      memberId: z.number().int().positive().optional(),
      amount: z.number().positive().optional(),
      contributedDate: z.string().optional(),
      contributionId: z.number().int().positive().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      createdat: z.string().optional(),
      causeId: z.number().int().positive().optional(),
      name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
    }),
    access: 'admin',
    category: 'pending',
    execute: (args, ctx) => pendingService.updatePendingTask(ctx.sessionId, ctx.memberId, ctx.isAdmin, args),
  },
  {
    name: 'cancel_pending_task',
    label: 'Cancelling pending action',
    description:
      'Discards the active pending task without executing it. Prefer telling the admin to use the Cancel button in the UI; use this tool if they ask to abort in natural language.',
    schema: z.object({}),
    access: 'admin',
    category: 'pending',
    execute: (_args, ctx) => pendingService.cancelPendingTask(ctx.sessionId, ctx.memberId, ctx.isAdmin),
  },
  {
    name: 'check_disbursement_feasibility',
    label: 'Checking fund availability',
    description:
      'Checks whether the fund has enough available balance for a proposed cause/disbursement amount. ' +
      'Call BEFORE propose_create_cause when an amount is specified. Returns feasible true/false and availableFunds.',
    schema: z.object({ amount: z.number().nonnegative() }),
    access: 'admin',
    category: 'read',
    execute: (args, ctx) => pendingService.checkDisbursementFeasibility(args.amount as number, ctx.isAdmin),
  },
];

// Serializes a tool result, capping length so the LLM context stays bounded.
const serializeResult = (result: unknown): string => {
  const json = JSON.stringify(result ?? null);
  return json.length > TOOL_RESULT_MAX_CHARS ? `${json.slice(0, TOOL_RESULT_MAX_CHARS)}... [truncated]` : json;
};

/**
 * Directly executes a tool by name, applying access control. Returns a JSON string.
 * Exposed for testing and reuse outside the LangGraph agent.
 */
export const executeTool = async (
  name: string,
  args: Record<string, unknown>,
  ctx: ChatToolContext,
): Promise<string> => {
  const definition = TOOL_DEFINITIONS.find((tool) => tool.name === name);
  if (!definition) {
    return serializeResult({ error: `Unknown tool: ${name}` });
  }
  if (definition.access === 'admin' && !ctx.isAdmin) {
    return serializeResult({ error: 'Admin access required' });
  }
  try {
    const result = await definition.execute(args, ctx);
    return serializeResult(result);
  } catch (error) {
    const message = error instanceof HttpError ? error.message : 'Tool execution failed';
    return serializeResult({ error: message });
  }
};

export type ChatToolMode = 'full' | 'pending_edit';

const isToolAllowed = (definition: ChatToolDefinition, ctx: ChatToolContext, mode: ChatToolMode): boolean => {
  if (definition.access === 'admin' && !ctx.isAdmin) {
    return false;
  }
  if (mode === 'pending_edit') {
    // Read, pending-management, and propose tools (propose auto-supersedes the current pending).
    return definition.category === 'read' || definition.category === 'pending' || definition.category === 'propose';
  }
  return true;
};

const filterDefinitions = (ctx: ChatToolContext, mode: ChatToolMode = 'full'): ChatToolDefinition[] =>
  TOOL_DEFINITIONS.filter((definition) => isToolAllowed(definition, ctx, mode));

/**
 * Builds LangChain tool instances bound to a request's context (member + admin flag).
 */
export const buildChatTools = (ctx: ChatToolContext, mode: ChatToolMode = 'full'): DynamicStructuredTool[] =>
  filterDefinitions(ctx, mode).map((definition) =>
    tool(async (args: Record<string, unknown>) => executeTool(definition.name, args, ctx), {
      name: definition.name,
      description: definition.description,
      schema: definition.schema,
    }),
  ) as DynamicStructuredTool[];

/**
 * Returns the tool names available to a given context (for diagnostics/UI).
 */
export const getToolNames = (ctx: ChatToolContext, mode: ChatToolMode = 'full'): string[] =>
  filterDefinitions(ctx, mode).map((d) => d.name);

export interface ChatToolMeta {
  readonly name: string;
  readonly label: string;
}

/**
 * Returns the name + progress-label catalog available to a given context, so the
 * UI can render friendly tool labels without hardcoding its own copy.
 */
export const getToolCatalog = (ctx: ChatToolContext): ChatToolMeta[] =>
  filterDefinitions(ctx, 'full').map((d) => ({
    name: d.name,
    label: d.label,
  }));

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Plain-language replacements when the model leaks an internal tool name. */
const TOOL_NAME_PHRASES: Record<string, string> = {
  get_fund_balance: 'fund balance',
  get_current_date_ist: "today's date",
  list_causes: 'cause records',
  get_cause: 'cause details',
  search_causes: 'cause search',
  list_cause_images: 'cause proof images',
  get_my_profile: 'your profile',
  list_my_contributions: 'your contributions',
  get_my_contribution_total: 'your contribution total',
  get_my_contribution: 'your contribution',
  list_members: 'member records',
  get_member: 'member details',
  search_members: 'member search',
  list_contributions: 'contribution records',
  get_contribution: 'contribution details',
  list_contribution_images: 'contribution proof images',
  get_contribution_summary: 'contribution summary',
  get_cause_summary: 'cause summary',
  propose_create_contribution: 'contribution proposal',
  propose_update_contribution: 'contribution update',
  propose_delete_contribution: 'contribution deletion',
  propose_create_cause: 'cause proposal',
  propose_update_cause: 'cause update',
  propose_delete_cause: 'cause deletion',
  propose_update_member: 'member update',
  propose_promote_member: 'admin promotion',
  propose_delete_member: 'member removal',
  get_pending_task: 'pending action',
  update_pending_task: 'pending update',
  cancel_pending_task: 'pending cancellation',
  check_disbursement_feasibility: 'fund availability check',
};

/**
 * Strips internal tool/function names from text shown to users.
 */
export const sanitizeAssistantReply = (text: string): string => {
  if (!text.trim()) {
    return text;
  }

  let out = text;
  for (const definition of TOOL_DEFINITIONS) {
    const phrase = TOOL_NAME_PHRASES[definition.name] ?? 'the records';
    const namePattern = escapeRegExp(definition.name);
    out = out.replace(new RegExp(`\`${namePattern}\``, 'gi'), phrase);
    out = out.replace(new RegExp(`\\b${namePattern}\\b`, 'gi'), phrase);
  }

  // Collapse common leakage patterns after replacements.
  out = out.replace(/\b(?:call|use|invoke|run)\s+(?:the\s+)?(?:records|member search|contribution records)\b/gi, 'look up the records');
  out = out.replace(/\*{0,2}Pending Task ID\*{0,2}\s*:?\s*\d+/gi, '');
  out = out.replace(/\bmemberId\s+\d+/gi, (match) => match.replace(/memberId\s+/i, 'member '));
  out = out.replace(/\n{3,}/g, '\n\n');
  return out.trim();
};
