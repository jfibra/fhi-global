import "server-only"

import { McpServer } from "@modelcontextprotocol/server"
import { NextRequest } from "next/server"
import { z } from "zod"
import { API_ENDPOINTS, type ApiEndpoint } from "@/lib/api-catalog"
import { SITE_URL } from "@/lib/seo"
import { GET as salesGet } from "@/app/api/external/sales/route"
import { GET as salesTopGet } from "@/app/api/external/sales/top/route"
import { GET as salesSummaryGet } from "@/app/api/external/sales/summary/route"
import { GET as agentsGet } from "@/app/api/external/agents/route"
import { GET as projectsGet } from "@/app/api/external/projects/route"
import { GET as developersGet } from "@/app/api/external/developers/route"
import { GET as teamsGet } from "@/app/api/external/teams/route"
import { GET as eventsGet } from "@/app/api/external/events/route"
import { GET as merchantsGet } from "@/app/api/external/merchants/route"

/**
 * FHI's MCP server (2026-11-23): the keyed external API as tools Claude can
 * call — in claude.ai (a custom connector), Claude Code, or FH ONE through
 * the Messages API's MCP connector. Read-only by construction: every tool
 * is one GET of app/api/external/*, invoked in-process with the caller's
 * own key, so the data, the filters and the rules are exactly the API's
 * (lib/api-catalog.ts is the one catalog; its text is the tools'
 * descriptions). A fresh server is built per request (stateless).
 */

export const MCP_SERVER_NAME = "fhi-global"
export const MCP_SERVER_VERSION = "1.0.0"

type Handler = (req: NextRequest) => Promise<Response>

const ISO_DAY = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD").describe("A day, YYYY-MM-DD")
const limit = (dflt: number) => z.number().int().min(1).max(100).default(dflt).describe(`How many rows, up to 100 (default ${dflt})`)
const page = z.number().int().min(1).default(1).describe("Page number, from 1")

/** The tools, each over one catalog entry: its zod schema is the endpoint's query parameters. */
const TOOLS: Array<{ key: string; name: string; handler: Handler; schema: z.ZodObject<z.ZodRawShape> }> = [
  {
    key: "sales",
    name: "fhi_sales",
    handler: salesGet,
    schema: z.object({
      from: ISO_DAY.optional().describe("From this business date (reservation date, else the day recorded), inclusive"),
      to: ISO_DAY.optional().describe("To this business date, inclusive"),
      status: z.enum(["validated", "pending", "invalid", "all"]).default("validated").describe("validated is what the leaderboards count"),
      agent: z.string().optional().describe("A profile id or an email; shared deals where they are a partner are included"),
      developer: z.string().optional().describe("A developer id"),
      project: z.string().optional().describe("A project id or slug"),
      merchant: z.string().optional().describe("A merchant id or code (M-4K7Q): rentals through that merchant's QR"),
      type: z.enum(["project", "brokerage", "rental"]).optional().describe("The kind of deal"),
      page,
      limit: limit(20),
    }),
  },
  {
    key: "sales-top",
    name: "fhi_top_sellers",
    handler: salesTopGet,
    schema: z.object({
      by: z.enum(["agents", "developers", "projects", "teams"]).default("agents"),
      from: ISO_DAY.optional().describe("Leave from and to out for all time"),
      to: ISO_DAY.optional(),
      developer: z.string().optional().describe("A developer id or slug, narrows the agents or projects board"),
      project: z.string().optional().describe("A project id or slug, narrows the agents board"),
      limit: limit(10),
    }),
  },
  {
    key: "sales-summary",
    name: "fhi_sales_summary",
    handler: salesSummaryGet,
    schema: z.object({
      from: ISO_DAY.optional().describe("Leave from and to out for all time (the breakdown then shows the last 12 months)"),
      to: ISO_DAY.optional(),
      group: z.enum(["month", "quarter", "year"]).default("month"),
      developer: z.string().optional().describe("A developer id or slug"),
      project: z.string().optional().describe("A project id or slug"),
      agent: z.string().optional().describe("A profile id or email: that agent's figures at their share"),
    }),
  },
  {
    key: "agents",
    name: "fhi_accounts",
    handler: agentsGet,
    schema: z.object({
      role: z.enum(["agent", "team_leader", "unit_manager", "global_partner", "all"]).optional().describe("Default: every selling role"),
      status: z.enum(["active", "pending", "inactive", "all"]).default("active"),
      team: z.string().optional().describe("A team id; its subteams are included"),
      q: z.string().optional().describe("Words to match in the name or email"),
      id: z.string().optional().describe("One person by profile id"),
      email: z.string().optional().describe("One person by email"),
      page,
      limit: limit(20),
    }),
  },
  {
    key: "projects",
    name: "fhi_projects",
    handler: projectsGet,
    schema: z.object({
      developer: z.string().optional().describe("A developer id or slug"),
      stage: z.enum(["pre_launch", "launch", "under_construction", "completed"]).optional(),
      area: z.string().optional().describe("Words to match in the community, sub-community, location or city"),
      handover: z.string().regex(/^\d{4}$/).optional().describe("A year: projects handing over that year"),
      q: z.string().optional().describe("Words to match in the name"),
      id: z.string().optional(),
      slug: z.string().optional(),
      page,
      limit: limit(10),
    }),
  },
  {
    key: "developers",
    name: "fhi_developers",
    handler: developersGet,
    schema: z.object({
      q: z.string().optional().describe("Words to match in the name"),
      id: z.string().optional(),
      slug: z.string().optional(),
      page,
      limit: limit(50),
    }),
  },
  {
    key: "teams",
    name: "fhi_teams",
    handler: teamsGet,
    schema: z.object({
      q: z.string().optional().describe("Words to match in the team name"),
      id: z.string().optional(),
      slug: z.string().optional(),
      status: z.enum(["active", "all"]).default("active"),
      from: ISO_DAY.optional().describe("The period for the sales figures; omit for all time"),
      to: ISO_DAY.optional(),
      include: z.enum(["members"]).optional().describe("members adds the member list"),
      page,
      limit: limit(20),
    }),
  },
  {
    key: "events",
    name: "fhi_events",
    handler: eventsGet,
    schema: z.object({
      when: z.enum(["upcoming", "past", "all"]).default("upcoming"),
      from: ISO_DAY.optional().describe("By the first day"),
      to: ISO_DAY.optional(),
      status: z.enum(["published", "draft", "all"]).default("published"),
      host: z.enum(["company", "agents", "all"]).default("all"),
      agent: z.string().optional().describe("A profile id: that agent's events"),
      q: z.string().optional().describe("Words to match in the title"),
      id: z.string().optional(),
      slug: z.string().optional(),
      include: z.enum(["days"]).optional().describe("days adds per-day seats"),
      page,
      limit: limit(20),
    }),
  },
  {
    key: "merchants",
    name: "fhi_merchants",
    handler: merchantsGet,
    schema: z.object({
      status: z.enum(["accepted", "submitted", "onboarding", "declined", "ended", "all"]).default("accepted"),
      agent: z.string().optional().describe("A profile id: the merchants that agent signed"),
      code: z.string().optional().describe("One merchant by its code, like M-4K7Q"),
      id: z.string().optional(),
      q: z.string().optional().describe("Words to match in the name or code"),
      include: z.enum(["deals"]).optional().describe("deals adds the figures and the newest rentals"),
      page,
      limit: limit(20),
    }),
  },
]

function describe(e: ApiEndpoint): string {
  const params = e.params.map((p) => `${p.name}: ${p.meaning}`).join(" · ")
  const notes = e.notes?.length ? ` ${e.notes.join(" ")}` : ""
  return `${e.summary} Returns ${e.returns}${notes} Parameters — ${params}`
}

/** One GET of the external API, in-process, with the caller's key, as a tool result. */
async function callEndpoint(handler: Handler, path: string, args: Record<string, unknown>, authorization: string) {
  const url = new URL(path, SITE_URL)
  for (const [k, v] of Object.entries(args)) if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v))
  const req = new NextRequest(url, { headers: { authorization, accept: "application/json" } })
  const res = await handler(req)
  const text = await res.text()
  if (!res.ok) {
    let message = text
    try {
      message = (JSON.parse(text) as { error?: string }).error ?? text
    } catch {
      // not JSON
    }
    return { content: [{ type: "text" as const, text: `FHI answered ${res.status}: ${message}` }], isError: true }
  }
  return { content: [{ type: "text" as const, text }] }
}

/**
 * A server for one request. `authorization` is the caller's own header,
 * already checked by the route; it is forwarded to the endpoints so the
 * same key, rate limit and rules apply.
 */
export function buildFhiMcpServer(authorization: string): McpServer {
  const server = new McpServer({ name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION, title: "FHI Global" })
  for (const t of TOOLS) {
    const e = API_ENDPOINTS.find((x) => x.key === t.key)
    if (!e) continue
    server.registerTool(
      t.name,
      {
        title: `FHI · ${e.name}`,
        description: describe(e),
        inputSchema: t.schema,
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async (args) => callEndpoint(t.handler, e.path, args as Record<string, unknown>, authorization),
    )
  }
  return server
}

/** What the API page and the guide print: how to connect. */
export const MCP_TOOL_NAMES = TOOLS.map((t) => t.name)
