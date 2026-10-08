"use client";

import { Bar, BarChart, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/money";
import { PALETTE } from "@/lib/palette";


export function DonutChart({ data }: { data: { name: string; value: number }[] }) {
  if (!data.length) return <p className="py-8 text-center text-sm text-muted-foreground">Sin gastos en el período.</p>;
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 224 }}>
        <PieChart>
          <Pie isAnimationActive={false} data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
            {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip formatter={(v) => formatMoney(Number(v))} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MonthlyBars({ data }: { data: { month: string; ingresos: number; gastos: number }[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 224 }}>
        <BarChart data={data}>
          <XAxis dataKey="month" tickFormatter={(m: string) => m.slice(5)} fontSize={12} />
          <YAxis hide />
          <Tooltip formatter={(v) => formatMoney(Number(v))} />
          <Legend />
          <Bar isAnimationActive={false} dataKey="ingresos" fill="#22c55e" radius={[4, 4, 0, 0]} />
          <Bar isAnimationActive={false} dataKey="gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
