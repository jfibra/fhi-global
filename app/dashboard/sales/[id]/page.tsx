import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import {
  ArrowLeft,
  Building2,
  Calendar,
  DollarSign,
  Paperclip,
  User,
} from "lucide-react"
import { DashboardShell } from "@/components/dashboard/shell"
import { getRoleColor } from "@/components/dashboard/sidebar-config"
import { roleToLabel } from "@/lib/auth"
import { ValidationDiscussion } from "./validation-discussion"

export const dynamic = "force-dynamic"

const ALLOWED_ROLES = ["super_admin", "admin", "team_leader", "unit_manager", "agent"]

function formatDate(value: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) + " AED"
}

function StatusBadge({ value }: { value: string }) {
  const colors: Record<string, string> = {
    pending:      "bg-amber-50 text-amber-700 border-amber-200",
    processing:   "bg-blue-50 text-blue-700 border-blue-200",
    approved:     "bg-emerald-50 text-emerald-700 border-emerald-200",
    released:     "bg-violet-50 text-violet-700 border-violet-200",
    rejected:     "bg-rose-50 text-rose-700 border-rose-200",
    under_review: "bg-sky-50 text-sky-700 border-sky-200",
    validated:    "bg-emerald-50 text-emerald-700 border-emerald-200",
    invalid_sale: "bg-rose-50 text-rose-700 border-rose-200",
  }
  const labels: Record<string, string> = {
    invalid_sale: "Invalid Sale",
    under_review: "Under Review",
  }
  const cls   = colors[value] ?? "bg-slate-100 text-slate-600 border-slate-200"
  const label = labels[value] ?? value.replace(/_/g, " ")
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border capitalize ${cls}`}>
      {label}
    </span>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">{label}</span>
      <span className="text-sm text-[#0d1117] font-medium">{value ?? <span className="text-[#9ca3af]">—</span>}</span>
    </div>
  )
}

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white/60 backdrop-blur-xl rounded-[20px] border border-white/60 shadow-sm shadow-black/5 p-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#001f3f] to-[#d6b357] flex items-center justify-center">
          <Icon className="w-4 h-4 text-white" />
        </div>
        <h3 className="font-['Space_Grotesk'] text-sm font-bold text-[#0d1117] uppercase tracking-wider">{title}</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-5">
        {children}
      </div>
    </div>
  )
}

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, fullname")
    .eq("id", user.id)
    .single()

  const roleValue = String(profile?.role ?? "").toLowerCase().trim()
  const isAdmin = roleValue === "admin"
  if (!profile || !ALLOWED_ROLES.includes(roleValue)) redirect("/dashboard")

  const { data: sale, error } = await supabase
    .from("sales_reports")
    .select(`
      *,
      developers(name),
      projects(name),
      project_units(unit_type),
      clients(first_name,middle_name,last_name,email,phone,age,gender,occupation,street,city,state_province,country),
      profiles:agent_id(fullname),
      sales_attachments(id)
    `)
    .eq("id", id)
    .single()

  if (!sale || error) notFound()

  // Agent, team leader, and unit manager can only view their own sales
  if (["agent", "team_leader", "unit_manager"].includes(roleValue) && sale.agent_id !== profile.id) {
    redirect("/dashboard/sales")
  }

  const clientName = sale.clients
    ? `${sale.clients.first_name} ${sale.clients.last_name}`
    : "—"

  const attachmentsCount = Array.isArray(sale.sales_attachments) ? sale.sales_attachments.length : 0
  const clientFull = sale.clients as {
    email?: string | null
    phone?: string | null
    age?: number | null
    gender?: string | null
    occupation?: string | null
    street?: string | null
    city?: string | null
    state_province?: string | null
    country?: string | null
  } | null

  return (
    <DashboardShell
      role={roleValue}
      roleLabel={roleToLabel(roleValue)}
      roleColor={getRoleColor(roleValue)}
      userName={profile.fullname || user.email || "User"}
    >
      <div className="space-y-6 max-w-4xl">

        {/* Back + header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link
              href="/dashboard/sales"
              className="inline-flex items-center gap-1.5 text-xs text-[#6b7280] hover:text-[#001f3f] transition-colors mb-3"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Sales Reports
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#001f3f] to-[#d6b357] flex items-center justify-center shadow-lg">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-['Space_Grotesk'] text-2xl font-bold tracking-tight text-[#0d1117]">
                  {clientName}
                </h1>
                <p className="text-sm text-[#6b7280]">
                  {sale.projects?.name ?? "—"} · {sale.developers?.name ?? "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 mt-8">
            <StatusBadge value={sale.commission_status} />
            <StatusBadge value={sale.validation_status} />
          </div>
        </div>

        {/* Property */}
        <SectionCard icon={Building2} title="Property Information">
          <DetailRow label="Developer" value={sale.developers?.name} />
          <DetailRow label="Project" value={sale.projects?.name} />
          <DetailRow label="Unit Type" value={sale.project_units?.unit_type} />
          <DetailRow label="Unit Number" value={sale.unit_number} />
          <DetailRow label="Block" value={sale.block_number} />
          <DetailRow label="Lot" value={sale.lot_number} />
        </SectionCard>

        {/* Client */}
        <SectionCard icon={User} title="Client Information">
          <DetailRow label="Full Name" value={clientName} />
          <DetailRow label="Email" value={clientFull?.email} />
          <DetailRow label="Phone" value={clientFull?.phone} />
          <DetailRow label="Age" value={clientFull?.age} />
          <DetailRow label="Gender" value={clientFull?.gender} />
          <DetailRow label="Occupation" value={clientFull?.occupation} />
          {clientFull?.street && (
            <div className="col-span-2 md:col-span-3">
              <DetailRow label="Address" value={[clientFull.street, clientFull.city, clientFull.state_province, clientFull.country].filter(Boolean).join(", ")} />
            </div>
          )}
        </SectionCard>

        {/* Contract */}
        <SectionCard icon={DollarSign} title="Contract Details">
          <DetailRow label="Contract Price" value={formatCurrency(sale.contract_price)} />
          <DetailRow label="Reservation Date" value={formatDate(sale.reservation_date)} />
          <DetailRow label="Price / SQM" value={sale.price_per_sqm ? formatCurrency(sale.price_per_sqm) : null} />
          <DetailRow label="Total Area (SQM)" value={sale.total_area_sqm ? `${sale.total_area_sqm} sqm` : null} />
          <DetailRow label="Payment Plan" value={sale.payment_plan} />
          {sale.payment_terms && (
            <div className="col-span-2 md:col-span-3">
              <DetailRow label="Payment Terms" value={sale.payment_terms} />
            </div>
          )}
          {sale.remarks && (
            <div className="col-span-2 md:col-span-3">
              <DetailRow label="Remarks" value={sale.remarks} />
            </div>
          )}
        </SectionCard>

        {/* Workflow */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/60 backdrop-blur-xl rounded-[20px] border border-white/60 shadow-sm shadow-black/5 p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] mb-3">Commission Status</p>
            <StatusBadge value={sale.commission_status} />
          </div>
          <div className="bg-white/60 backdrop-blur-xl rounded-[20px] border border-white/60 shadow-sm shadow-black/5 p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] mb-3">Validation Status</p>
            <StatusBadge value={sale.validation_status} />
          </div>
        </div>

        {/* Meta */}
        <div className="bg-white/60 backdrop-blur-xl rounded-[20px] border border-white/60 shadow-sm shadow-black/5 p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            <DetailRow label="Agent" value={sale.profiles?.fullname} />
            <DetailRow label="Attachments" value={
              <span className="inline-flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5" />
                {attachmentsCount} file{attachmentsCount !== 1 ? "s" : ""}
              </span>
            } />
            <DetailRow label="Created" value={formatDate(sale.created_at)} />
            <DetailRow label="Updated" value={formatDate(sale.updated_at)} />
          </div>
        </div>

        <ValidationDiscussion
          saleId={sale.id}
          currentUserId={profile.id}
          currentRole={roleValue}
          validationStatus={sale.validation_status}
          isAdmin={isAdmin}
        />
      </div>
    </DashboardShell>
  )
}
