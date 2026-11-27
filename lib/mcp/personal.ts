import "server-only"

import { McpServer, fromJsonSchema, type JsonSchemaType } from "@modelcontextprotocol/server"
import { roleToLabel } from "@/lib/app-roles"
import { agentChatToolsFor, runAgentChatTool, type AgentChatCaller } from "@/lib/fhi-agent-chat-tools"
import { eventToolNotes, registerEventTools, type EventWriter } from "@/lib/mcp/events"
import { MCP_SERVER_NAME, MCP_SERVER_VERSION } from "@/lib/mcp/server"

/**
 * The MCP server a signed-in agent or team leader gets (POST /api/mcp/me,
 * 2026-11-24): the agent FHI Assistant's tools (lib/fhi-agent-chat-tools.ts)
 * bound to the caller, exactly as the dashboard chat runs them — "my sales"
 * is always theirs, the team tools refuse anyone who is not a team leader,
 * another person's amounts are not in what the tools return.
 *
 * Reading only. The tools that write (mark a lead contacted, send a member a
 * message), that build a PDF for the dashboard, or that call the chat model
 * themselves (client message drafts, the performance report's coaching) are
 * left out; the note, reminder and goal tools are limited to their read
 * actions. Adding or changing stays in the dashboard assistant.
 *
 * The one exception (2026-11-27): the event tools of lib/mcp/events.ts,
 * added only when the route hands in an `events` writer — the person ticked
 * the events box on the consent screen and their role runs its own events.
 * They reach ONLY the events that person owns.
 */

const SKIP = new Set(["project_brochure", "project_comparison", "client_message", "my_report", "mark_lead_contacted", "member_message"])

/** Tools with an `action`: the read actions allowed here, first = the default when Claude sends none. */
const READ_ACTIONS: Record<string, string[]> = {
  client_note: ["list", "find"],
  reminder: ["list"],
  my_goal: ["get"],
}

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }

const WRITE_REFUSED = "Claude only reads here. To add or change notes, reminders or your sales goal, use the FHI Assistant in your FHI dashboard."

export function buildPersonalMcpServer(caller: AgentChatCaller, opts: { events?: EventWriter } = {}): McpServer {
  const who = caller.name ? `${caller.name} (${roleToLabel(caller.role)})` : roleToLabel(caller.role)
  const server = new McpServer(
    { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION, title: "FHI Global" },
    {
      instructions: `You are connected to FHI Global, a Dubai real-estate company, as ${who}. Every tool answers with this person's own FHI data (their sales, leads, listings, website, events, reviews, recruits, notes and reminders${caller.role === "team_leader" ? ", and their team" : ""}) plus what the dashboard shows everyone (the Top Sales board, projects, developers, news). Amounts are in AED. Dates are YYYY-MM-DD and to_date is exclusive. ${opts.events ? eventToolNotes(opts.events) : "Nothing here writes to FHI."}`,
    },
  )
  if (opts.events) registerEventTools(server, opts.events)
  for (const t of agentChatToolsFor(caller.role)) {
    const f = t.function
    if (SKIP.has(f.name)) continue
    const reads = READ_ACTIONS[f.name]
    server.registerTool(
      `fhi_${f.name}`,
      {
        title: `FHI · ${f.name.replace(/_/g, " ")}`,
        description: `${f.description} Dates are YYYY-MM-DD (to_date exclusive).${reads ? ` Here only the ${reads.join(" and ")} action${reads.length > 1 ? "s are" : " is"} available.` : ""}`,
        inputSchema: fromJsonSchema(f.parameters as JsonSchemaType),
        annotations: READ_ONLY,
      },
      async (args) => {
        const a = { ...((args ?? {}) as Record<string, unknown>) }
        if (reads) {
          const action = typeof a.action === "string" && a.action ? a.action : reads[0]
          if (!reads.includes(action)) return { content: [{ type: "text" as const, text: WRITE_REFUSED }], isError: true }
          a.action = action
        }
        const r = await runAgentChatTool(f.name, a, caller)
        return { content: [{ type: "text" as const, text: r.forModel }], isError: r.forModel.startsWith('{"error"') }
      },
    )
  }
  return server
}
