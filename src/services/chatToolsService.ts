import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import type { DynamicStructuredTool } from '@langchain/core/tools';
import { HttpError } from '../middlewares/errorHandler.js';
import * as readService from './chatReadService.js';

export interface ChatToolContext {
  readonly memberId: number;
  readonly isAdmin: boolean;
}

type ToolAccess = 'member' | 'admin';

interface ChatToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly schema: z.ZodObject<z.ZodRawShape>;
  readonly access: ToolAccess;
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
    description: 'Returns total contributions, total disbursements (causes), and available fund balance.',
    schema: z.object({}),
    access: 'member',
    execute: () => readService.getFundStatus(),
  },
  {
    name: 'list_causes',
    description: 'Lists fundraising causes / disbursements, newest first. Optional date range filter.',
    schema: z.object({ ...limitShape, ...dateRangeShape }),
    access: 'member',
    execute: (args) =>
      readService.listCauses({
        limit: args.limit as number | undefined,
        fromDate: parseDate(args.fromDate),
        toDate: parseDate(args.toDate),
      }),
  },
  {
    name: 'get_cause',
    description: 'Get a single fundraising cause by its ID.',
    schema: z.object({ causeId: z.number().int().describe('Cause ID') }),
    access: 'member',
    execute: (args) => readService.getCause(args.causeId as number),
  },
  {
    name: 'search_causes',
    description: 'Search causes by keyword in title or description.',
    schema: z.object({ query: z.string().min(1), ...limitShape }),
    access: 'member',
    execute: (args) => readService.searchCauses(args.query as string, args.limit as number | undefined),
  },
  {
    name: 'list_cause_images',
    description: 'List proof-of-payment image URLs for a cause.',
    schema: z.object({ causeId: z.number().int() }),
    access: 'member',
    execute: (args) => readService.listCauseImages(args.causeId as number),
  },
  // ---- Tier B: member-scoped ----
  {
    name: 'get_my_profile',
    description: "Returns the current user's profile (name, join date, admin status). No password or verification data.",
    schema: z.object({}),
    access: 'member',
    execute: (_args, ctx) => readService.getMyProfile(ctx.memberId),
  },
  {
    name: 'list_my_contributions',
    description: 'Lists contributions made by the current user, optionally filtered by date range.',
    schema: z.object({ ...limitShape, ...dateRangeShape }),
    access: 'member',
    execute: (args, ctx) =>
      readService.listMyContributions(ctx.memberId, {
        limit: args.limit as number | undefined,
        fromDate: parseDate(args.fromDate),
        toDate: parseDate(args.toDate),
      }),
  },
  {
    name: 'get_my_contribution_total',
    description: 'Returns the total amount the current user has contributed.',
    schema: z.object({}),
    access: 'member',
    execute: (_args, ctx) => readService.getMyContributionTotal(ctx.memberId),
  },
  {
    name: 'get_my_contribution',
    description: 'Get a single contribution by ID if it belongs to the current user.',
    schema: z.object({ contributionId: z.number().int() }),
    access: 'member',
    execute: (args, ctx) => readService.getMyContribution(ctx.memberId, args.contributionId as number),
  },
  // ---- Tier C: admin only ----
  {
    name: 'list_members',
    description: 'List all registered members (sanitized, no passwords).',
    schema: z.object({ ...limitShape }),
    access: 'admin',
    execute: (args) => readService.listMembers(args.limit as number | undefined),
  },
  {
    name: 'get_member',
    description: 'Get a member by ID.',
    schema: z.object({ memberId: z.number().int() }),
    access: 'admin',
    execute: (args) => readService.getMember(args.memberId as number),
  },
  {
    name: 'search_members',
    description: 'Search members by name or email.',
    schema: z.object({ query: z.string().min(1), ...limitShape }),
    access: 'admin',
    execute: (args) => readService.searchMembers(args.query as string, args.limit as number | undefined),
  },
  {
    name: 'list_contributions',
    description: 'List all contributions across members with member names. Optional member and date filters.',
    schema: z.object({
      ...limitShape,
      memberId: z.number().int().optional().describe('Optional filter by member'),
      ...dateRangeShape,
    }),
    access: 'admin',
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
    description: 'Get any contribution by ID with the member name (admin).',
    schema: z.object({ contributionId: z.number().int() }),
    access: 'admin',
    execute: (args) => readService.getContribution(args.contributionId as number),
  },
  {
    name: 'list_contribution_images',
    description: 'List proof images for any contribution (admin).',
    schema: z.object({ contributionId: z.number().int() }),
    access: 'admin',
    execute: (args) => readService.listContributionImages(args.contributionId as number),
  },
  {
    name: 'get_contribution_summary',
    description: 'Aggregate contribution statistics: total amount, count, and top contributors. Optional date range.',
    schema: z.object({ ...dateRangeShape }),
    access: 'admin',
    execute: (args) =>
      readService.getContributionSummary({ fromDate: parseDate(args.fromDate), toDate: parseDate(args.toDate) }),
  },
  {
    name: 'get_cause_summary',
    description: 'Aggregate cause/disbursement statistics: total amount spent and count. Optional date range.',
    schema: z.object({ ...dateRangeShape }),
    access: 'admin',
    execute: (args) =>
      readService.getCauseSummary({ fromDate: parseDate(args.fromDate), toDate: parseDate(args.toDate) }),
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

/**
 * Builds LangChain tool instances bound to a request's context (member + admin flag).
 */
export const buildChatTools = (ctx: ChatToolContext): DynamicStructuredTool[] =>
  TOOL_DEFINITIONS.map((definition) =>
    tool(async (args: Record<string, unknown>) => executeTool(definition.name, args, ctx), {
      name: definition.name,
      description: definition.description,
      schema: definition.schema,
    }),
  ) as DynamicStructuredTool[];

/**
 * Returns the tool names available to a given context (for diagnostics/UI).
 */
export const getToolNames = (ctx: ChatToolContext): string[] =>
  TOOL_DEFINITIONS.filter((definition) => definition.access === 'member' || ctx.isAdmin).map((d) => d.name);
