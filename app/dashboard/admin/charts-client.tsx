"use client"

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
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

function PieCard({ title, data }: { title: string; data: StatusItem[] }) {
  const total = data.reduce((s, d) => s + d.count, 0)
  return (
    <div className="rounded-2xl bg-white border border-[#e8eaed] shadow-[0_2px_12px_-2px_rgba(0,31,63,0.06)] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#9ca3af] mb-1">Distribution</p>
      <h3 className="text-sm font-bold text-[#0d1117] mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => [v ?? 0, ""]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-3 space-y-1.5">
        {data.map((item, index) => (
          <div key={`${item.label}-${index}`} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
              <span className="text-[#374151]">{item.label}</span>
            </span>
            <span className="font-semibold text-[#0d1117]">
              {item.count}
              <span className="ml-1 text-[#9ca3af] font-normal">
                ({total > 0 ? Math.round((item.count / total) * 100) : 0}%)
              </span>
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
      <div className="rounded-2xl bg-white border border-[#e8eaed] shadow-[0_2px_12px_-2px_rgba(0,31,63,0.06)] p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#9ca3af] mb-1">Trend</p>
        <h3 className="text-sm font-bold text-[#0d1117] mb-4">Monthly Sales Volume &amp; Value (Last 12 Months)</h3>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={monthlySales} margin={{ top: 4, right: 16, bottom: 0, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => AED.format(v)}
            />
            <Tooltip
              formatter={(value, name) =>
                name === "value" ? [AED.format(Number(value ?? 0)), "Contract Value"] : [value ?? 0, "Sales Count"]
              }
              contentStyle={{ borderRadius: 12, border: "1px solid #e8eaed", fontSize: 12 }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              formatter={v => (v === "count" ? "Sales Count" : "Contract Value")}
            />
            <Bar yAxisId="left" dataKey="count" name="count" fill="#0ea5e9" radius={[6, 6, 0, 0]} maxBarSize={32} />
            <Bar yAxisId="right" dataKey="value" name="value" fill="#d6b357" radius={[6, 6, 0, 0]} maxBarSize={32} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Three Pie Charts */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <PieCard title="Sales by Developer" data={developerSales.map(d => ({ label: d.developer, count: d.count, color: d.color }))} />
        <PieCard title="Project Status" data={projectStatus} />
        <PieCard title="Validation Status" data={validationStatus} />
      </div>
    </div>
  )
}
