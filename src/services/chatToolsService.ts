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
    description: 'Search members by name or email.',
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
      'Propose creating a new contribution. Requires memberId (from search_members), amount, and contributedDate (YYYY-MM-DD). Creates a pending task awaiting admin confirmation.',
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
    description: 'Propose updating an existing contribution. Creates a pending task awaiting confirmation.',
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
    description: 'Propose deleting a contribution. Creates a pending task awaiting confirmation.',
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
      'Propose creating a new cause/disbursement. Use check_disbursement_feasibility first if amount is specified. Creates a pending task awaiting confirmation.',
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
    description: 'Propose updating an existing cause. Creates a pending task awaiting confirmation.',
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
    description: 'Propose deleting a cause. Creates a pending task awaiting confirmation.',
    schema: z.object({ causeId: z.number().int().positive() }),
    access: 'admin',
    category: 'propose',
    execute: (args, ctx) => pendingService.proposeDeleteCause(ctx.sessionId, ctx.memberId, ctx.isAdmin, args),
  },
  {
    name: 'propose_update_member',
    label: 'Drafting member update',
    description: 'Propose updating a member profile (name, email, phone). Creates a pending task awaiting confirmation.',
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
    description: 'Propose promoting a member to admin. Creates a pending task awaiting confirmation.',
    schema: z.object({ memberId: z.number().int().positive() }),
    access: 'admin',
    category: 'propose',
    execute: (args, ctx) => pendingService.proposePromoteMember(ctx.sessionId, ctx.memberId, ctx.isAdmin, args),
  },
  {
    name: 'propose_delete_member',
    label: 'Drafting member deletion',
    description: 'Propose deleting a member. Creates a pending task awaiting confirmation.',
    schema: z.object({ memberId: z.number().int().positive() }),
    access: 'admin',
    category: 'propose',
    execute: (args, ctx) => pendingService.proposeDeleteMember(ctx.sessionId, ctx.memberId, ctx.isAdmin, args),
  },
  {
    name: 'get_pending_task',
    label: 'Checking pending action',
    description: 'Returns the active pending task awaiting confirmation in this chat session.',
    schema: z.object({}),
    access: 'admin',
    category: 'pending',
    execute: (_args, ctx) => pendingService.getPendingTask(ctx.sessionId, ctx.isAdmin),
  },
  {
    name: 'update_pending_task',
    label: 'Updating pending action',
    description: 'Modify fields on the active pending task (e.g. change amount or member). Regenerates the summary.',
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
    description: 'Reject/cancel the active pending task without executing it.',
    schema: z.object({}),
    access: 'admin',
    category: 'pending',
    execute: (_args, ctx) => pendingService.cancelPendingTask(ctx.sessionId, ctx.memberId, ctx.isAdmin),
  },
  {
    name: 'check_disbursement_feasibility',
    label: 'Checking fund availability',
    description: 'Checks whether a proposed cause amount can be disbursed from available funds.',
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
