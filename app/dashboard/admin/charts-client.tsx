"use client"

import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts"

interface MonthlySale {
  month: string
  count: number
  value: number
}

interface DeveloperSale {
  developer: string
  count: number
  color: string
}

interface StatusItem {
  label: string
  count: number
  color: string
}

interface Props {
  monthlySales: MonthlySale[]
  developerSales: DeveloperSale[]
  projectStatus: StatusItem[]
  validationStatus: StatusItem[]
}

const AED = new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 })

// ─── Bar chart card matching the image design ──────────────────────────────────

function BarCard({ title, data }: { title: string; data: Array<{ label: string; count: number; color: string }> }) {
  const total = data.reduce((s, d) => s + d.count, 0)
  // Recharts needs a flat structure for per-bar coloring — transform to one-entry-per-bar
  const chartData = data.map(d => ({ name: d.label, value: d.count, color: d.color }))

  return (
    <div className="rounded-2xl bg-white border border-[#e8eaed] p-5">
      <h3 className="text-[15px] font-semibold text-[#374151] mb-4">{title}</h3>

      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -28 }} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
          <XAxis
            dataKey="name"
            tick={false}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
          />
          <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "rgba(0,31,63,0.04)" }}
            contentStyle={{ borderRadius: 10, border: "1px solid #e8eaed", fontSize: 12 }}
            formatter={(value, _name, props) => [value, props.payload?.name ?? ""]}
          />
          <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={40}>
            {chartData.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-4 space-y-2">
        {data.map((item, index) => (
          <div key={`${item.label}-${index}`} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
              <span className="text-[#374151] text-[12px]">{item.label}</span>
            </span>
            <span className="text-[#374151] text-[12px]">
              {item.count}&nbsp;
              <span className="text-[#9ca3af]">({total > 0 ? Math.round((item.count / total) * 100) : 0}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AdminAnalyticsCharts({ monthlySales, developerSales, projectStatus, validationStatus }: Props) {
  return (
    <div className="space-y-5">
      {/* Monthly Sales Bar Chart */}
      <div className="rounded-2xl bg-white border border-[#e8eaed] p-6 shadow-sm">
        <h3 className="text-[17px] font-medium text-[#4b5563] mb-6 tracking-wide">Monthly Sales Volume &amp; Value (Last 12 Months)</h3>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={monthlySales} margin={{ top: 20, right: 20, bottom: 20, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={true} stroke="#f3f4f6" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7280" }} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#6b7280" }} tickLine={false} axisLine={false} />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => v === 0 ? "AED 0" : AED.format(v)}
            />
            <Tooltip
              formatter={(value, name) =>
                name === "value" ? [AED.format(Number(value ?? 0)), "Contract Value"] : [value ?? 0, "Sales Count"]
              }
              contentStyle={{ borderRadius: 12, border: "1px solid #e8eaed", fontSize: 12 }}
              cursor={{ fill: "transparent" }}
            />
            <Bar yAxisId="left" dataKey="count" name="count" fill="#001f3f" radius={[2, 2, 0, 0]} maxBarSize={28} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Three Bar Charts — Sales by Developer, Project Status, Validation Status */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <BarCard
          title="Sales by Developer"
          data={developerSales.map(d => ({ label: d.developer, count: d.count, color: d.color }))}
        />
        <BarCard title="Project Status" data={projectStatus} />
        <BarCard title="Validation Status" data={validationStatus} />
      </div>
    </div>
  )
}
