import "server-only"

/**
 * Streaming for both FHI Assistant routes (admin app/api/admin/fhi-chat,
 * agents app/api/fhi-chat) — speed pass, 2026-10-15. Measured before: a
 * typical answer took 3–7 s on the server and the page then replayed it with
 * a typewriter for another 1–5 s, with nothing on screen meanwhile. Now:
 *
 *   • streamCompletion — one OpenAI round with stream: true. Text deltas are
 *     handed to `onDelta` as they arrive; tool-call deltas are assembled into
 *     the same message shape the non-streaming API returned.
 *   • sseResponse — the route's answer as Server-Sent Events, one JSON event
 *     per `data:` line: status (which lookups are running), delta (answer
 *     text), reset (a round that started writing turned out to call tools),
 *     done (the final payload — cards, charts, tiles…) or error.
 *
 * text/event-stream so Cloudflare and Vercel pass every chunk straight
 * through instead of buffering the response.
 */

export type ChatMessage = {
  role: "user" | "assistant" | "system" | "tool"
  content: string | null
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>
  tool_call_id?: string
}

export type ChatStreamEvent =
  | { type: "status"; tools: string[] }
  | { type: "delta"; text: string }
  | { type: "reset" }
  | ({ type: "done" } & Record<string, unknown>)
  | { type: "error"; error: string; status?: number; quota?: unknown }

type Usage = { prompt: number; completion: number }
type Round = { ok: true; message: ChatMessage; usage: Usage } | { ok: false; status: number; error: string; usage: Usage }

export async function streamCompletion(opts: {
  apiKey: string
  model: string
  messages: ChatMessage[]
  tools: unknown[]
  toolChoice: "auto" | "none"
  temperature?: number
  onDelta?: (text: string) => void
}): Promise<Round> {
  const usage: Usage = { prompt: 0, completion: 0 }
  const call = () =>
    fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.apiKey}` },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        tools: opts.tools,
        tool_choice: opts.toolChoice,
        temperature: opts.temperature ?? 0.1,
        stream: true,
        stream_options: { include_usage: true },
      }),
    })
  let res: Response
  try {
    res = await call()
  } catch {
    // A transient network failure before anything streamed: retry once.
    try {
      await new Promise((r) => setTimeout(r, 700))
      res = await call()
    } catch {
      return { ok: false, status: 502, error: "Couldn't reach the AI service — try again.", usage }
    }
  }
  if (!res.ok || !res.body) {
    const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    return { ok: false, status: 502, error: data?.error?.message ?? `AI service error (${res.status})`, usage }
  }

  let content = ""
  const calls: Array<{ id: string; name: string; args: string }> = []
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let nl: number
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim()
      buffer = buffer.slice(nl + 1)
      if (!line.startsWith("data:")) continue
      const payload = line.slice(5).trim()
      if (payload === "[DONE]") continue
      let chunk: {
        choices?: Array<{ delta?: { content?: string | null; tool_calls?: Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }> } }>
        usage?: { prompt_tokens?: number; completion_tokens?: number }
      }
      try {
        chunk = JSON.parse(payload)
      } catch {
        continue
      }
      if (chunk.usage) {
        usage.prompt += chunk.usage.prompt_tokens ?? 0
        usage.completion += chunk.usage.completion_tokens ?? 0
      }
      const delta = chunk.choices?.[0]?.delta
      if (!delta) continue
      if (delta.content) {
        content += delta.content
        opts.onDelta?.(delta.content)
      }
      for (const t of delta.tool_calls ?? []) {
        const slot = (calls[t.index] ??= { id: "", name: "", args: "" })
        if (t.id) slot.id = t.id
        if (t.function?.name) slot.name += t.function.name
        if (t.function?.arguments) slot.args += t.function.arguments
      }
    }
  }
  const toolCalls = calls.filter(Boolean).map((c) => ({ id: c.id, type: "function" as const, function: { name: c.name, arguments: c.args } }))
  return { ok: true, message: { role: "assistant", content: content || null, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) }, usage }
}

/**
 * Server-Sent Events from an async producer: `opening` goes out at once (so
 * proxies open the stream before the slow part starts), an exception becomes
 * `onError`. Used by the chat routes and the company report's staged load.
 */
export function sseEvents<E extends { type: string }>(run: (send: (e: E) => void) => Promise<void>, opening: E | null, onError: E): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: E) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`))
      if (opening) send(opening)
      try {
        await run(send)
      } catch {
        send(onError)
      } finally {
        controller.close()
      }
    },
  })
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  })
}

/** The chat routes' stream: "Thinking…" at once, then status / delta / done. */
export function sseResponse(run: (send: (e: ChatStreamEvent) => void) => Promise<void>): Response {
  return sseEvents<ChatStreamEvent>(run, { type: "status", tools: [] }, { type: "error", error: "FHI Assistant couldn't answer — try again." })
}

/** Strip the markdown the model sometimes emits despite the rules — the UI renders plain text. */
export const cleanReply = (text: string) =>
  text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")

/** "How do we market the website", "how can I sell more", "what should we do" — both assistants answer these on a stronger model, grounded in the asker's figures. */
const ADVICE_RE =
  /\b(advice|advise|suggest(ion)?s?|recommend\w*|tips?|strateg(y|ies)|action plan)\b|\bwhat (should|can|could) (we|i)\b|\bhow (can|do|should|could) (we|i) (improve|increase|get|grow|boost|market|attract|activate|sell|convert|make)\b|\bhow to (improve|increase|get|grow|boost|market|attract|activate|sell|convert)\b|\bbest (way|thing|things) to\b|\bmore productive\b/i
export const isAdviceQuestion = (q: string) => ADVICE_RE.test(q)
