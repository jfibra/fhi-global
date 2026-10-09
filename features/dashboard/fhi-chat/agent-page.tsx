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
  { label: "My sales", items: ["How are my sales this year?", "Anything of mine waiting for validation?", "Where do I rank this year?"] },
  { label: "My leads & clients", items: ["Any priority buyers in my leads?", "Who sent me a brief this week?", "What do clients say about me?"] },
  { label: "My pages", items: ["Which of my listings are live?", "Is my website live?", "Are my recruits selling?"] },
  { label: "Projects & news", items: ["Cheapest 1-bedroom in JVC?", "Payment plan of Samana Greenfield", "What's the latest property news?"] },
] as const

const TEAM_LEADER_SUGGESTIONS = [
  { label: "My team", items: ["How is my team doing this month?", "Who in my team hasn't sold this year?", "Anything of my team waiting for validation?"] },
  ...SUGGESTIONS,
] as const

const REPORTS = [
  { label: "My month", prompt: "How are my sales this month?" },
  { label: "My year", prompt: "How are my sales this year?" },
  { label: "Top sellers", prompt: "Who are the top sellers this month, and where do I rank?" },
] as const
const TEAM_LEADER_REPORTS = [{ label: "My team", prompt: "How is my team doing this month?" }, ...REPORTS] as const

export default function AgentFhiChatPage() {
  const { role } = useAuth()
  const allowed = useRequireAllowed(roleInList(role, ROLES_AGENT_ASSISTANT) || roleInList(role, ROLES_ADMIN_STAFF))
  if (!allowed) return null
  return (
    <FhiChatPage
      endpoint="/api/fhi-chat"
      storageKey="fhi-assistant-chat-agent"
      subtitle="Your sales, leads, listings, website, reviews and recruits — plus projects and news, straight from the live database."
      intro={{ title: "Your numbers, answered.", text: "Ask about your own sales, leads, listings, website, reviews and recruits, where you stand on the Top Sales board, any project FHI sells, or the latest property news." }}
      suggestions={role === "team_leader" ? TEAM_LEADER_SUGGESTIONS : SUGGESTIONS}
      reports={role === "team_leader" ? TEAM_LEADER_REPORTS : REPORTS}
      placeholder='Ask FHI Assistant — e.g. "How are my sales this month?"'
      footnote="Covers your own sales, leads, listings, website, reviews, recruits, the Top Sales board, projects and news · answers are computed from the live database when you ask."
      quota
    />
  )
}
