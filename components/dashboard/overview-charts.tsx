'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line
} from 'recharts';

/**
 * The Overview's two recharts charts, split out so app/dashboard/page.tsx can
 * load them with next/dynamic: recharts is ~380 KB of JS, and keeping it out of
 * the Overview's initial bundle lets the metrics and queues paint first.
 */
export interface OverviewChartColors {
  chartColor: string;
  gridColor: string;
  textColor: string;
  tooltipBg: string;
}

export function VelocityChart({ data, colors: { chartColor, gridColor, textColor, tooltipBg } }: { data: { name: string; points: number }[]; colors: OverviewChartColors }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
        <CartesianGrid strokeDasharray="2 2" vertical={false} stroke={gridColor} />
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontFamily: 'monospace', fill: textColor }} dy={15} />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontFamily: 'monospace', fill: textColor }} />
        <Tooltip
          contentStyle={{ borderRadius: '0', border: `1px solid ${chartColor}`, fontSize: '12px', fontFamily: 'monospace', backgroundColor: tooltipBg, textTransform: 'uppercase' }}
          cursor={{ stroke: gridColor, strokeWidth: 1, strokeDasharray: '4 4' }}
        />
        <Line type="step" dataKey="points" stroke={chartColor} strokeWidth={2} dot={{ r: 4, fill: tooltipBg, stroke: chartColor, strokeWidth: 2 }} activeDot={{ r: 6, fill: chartColor }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function WorkloadChart({ data, colors: { chartColor, gridColor, textColor, tooltipBg } }: { data: { name: string; open: number }[]; colors: OverviewChartColors }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
        <CartesianGrid strokeDasharray="2 2" vertical={false} stroke={gridColor} />
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontFamily: 'monospace', fill: textColor }} dy={15} />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontFamily: 'monospace', fill: textColor }} />
        <Tooltip
          cursor={{ fill: gridColor, opacity: 0.5 }}
          contentStyle={{ borderRadius: '0', border: `1px solid ${chartColor}`, fontSize: '12px', fontFamily: 'monospace', backgroundColor: tooltipBg, textTransform: 'uppercase' }}
        />
        <Bar dataKey="open" fill={chartColor} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}
