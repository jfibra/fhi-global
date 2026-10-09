"use client"

import { useAuth } from "@/context/auth-context"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { ROLES_ADMIN_STAFF, ROLES_AGENT_ASSISTANT, roleInList } from "@/lib/app-roles"
import FhiChatPage from "./page"

/**
 * FHI Assistant for agents and team leaders: the admin chat UI pointed at
 * app/api/fhi-chat (own sales, Top Sales board, projects, news) with a daily
 * question counter. Everything it can see, the person already sees in their
 * own dashboard.
 */

const SUGGESTIONS = [
  { label: "My sales", items: ["How are my sales this year?", "Anything of mine waiting for validation?", "My sales month by month"] },
  { label: "Top Sales board", items: ["Where do I rank this year?", "Who are the top sellers this month?", "Am I in the top 10 this quarter?"] },
  { label: "Projects", items: ["Cheapest 1-bedroom in JVC?", "Payment plan of Samana Greenfield", "Villas under AED 3M handing over by 2027"] },
  { label: "News", items: ["What's the latest property news?", "Most read article this week?"] },
] as const

const REPORTS = [
  { label: "My month", prompt: "How are my sales this month?" },
  { label: "My year", prompt: "How are my sales this year?" },
  { label: "Top sellers", prompt: "Who are the top sellers this month, and where do I rank?" },
] as const

export default function AgentFhiChatPage() {
  const { role } = useAuth()
  const allowed = useRequireAllowed(roleInList(role, ROLES_AGENT_ASSISTANT) || roleInList(role, ROLES_ADMIN_STAFF))
  if (!allowed) return null
  return (
    <FhiChatPage
      endpoint="/api/fhi-chat"
      storageKey="fhi-assistant-chat-agent"
      subtitle="Your sales, the Top Sales board, projects and news — straight from the live database."
      intro={{ title: "Your numbers, answered.", text: "Ask about your own sales, where you stand on the Top Sales board, any project FHI sells, or the latest property news." }}
      suggestions={SUGGESTIONS}
      reports={REPORTS}
      placeholder='Ask FHI Assistant — e.g. "How are my sales this month?"'
      footnote="Covers your own sales, the Top Sales board, projects and news · answers are computed from the live database when you ask."
      quota
    />
  )
}
