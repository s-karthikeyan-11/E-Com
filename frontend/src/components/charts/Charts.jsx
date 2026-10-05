import React from 'react';
import { fmtINR } from '../../utils/currency';

// Line/area chart for revenue by day. Pure SVG, no extra dependency.
export const LineChart = ({ data, valueKey = 'revenue', color = '#059669' }) => {
  const W = 640;
  const H = 240;
  const pad = { t: 16, r: 16, b: 28, l: 52 };
  if (!data?.length) return <p className="py-10 text-center text-sm text-slate-500">No data for this period.</p>;

  const max = Math.max(...data.map((d) => d[valueKey]), 1);
  const x = (i) => pad.l + (data.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (data.length - 1));
  const y = (v) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d[valueKey])}`).join(' ');
  const area = `${line} L${x(data.length - 1)},${H - pad.b} L${x(0)},${H - pad.b} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const labelEvery = Math.ceil(data.length / 6);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Revenue by day">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(max * t)} y2={y(max * t)} stroke="#e2e8f0" />
          <text x={pad.l - 8} y={y(max * t) + 4} textAnchor="end" fontSize="10" fill="#64748b">{fmtINR(max * t)}</text>
        </g>
      ))}
      <path d={area} fill={color} opacity="0.12" />
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
      {data.map((d, i) => (
        <g key={d.date}>
          <circle cx={x(i)} cy={y(d[valueKey])} r="3" fill={color}>
            <title>{`${d.date}: ${fmtINR(d[valueKey])} (${d.orders} orders)`}</title>
          </circle>
          {i % labelEvery === 0 && (
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#64748b">{d.date.slice(5)}</text>
          )}
        </g>
      ))}
    </svg>
  );
};

// Horizontal bar chart: items = [{ label, value, sub }]
export const BarList = ({ items, color = '#7c3aed', format = fmtINR }) => {
  if (!items?.length) return <p className="py-6 text-center text-sm text-slate-500">No data for this period.</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-3">
      {items.map((i) => (
        <div key={i.label}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-medium text-slate-700">{i.label}</span>
            <span className="shrink-0 font-semibold text-slate-900">{format(i.value)}</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100">
            <div className="h-2.5 rounded-full" style={{ width: `${(i.value / max) * 100}%`, background: color }} />
          </div>
          {i.sub && <div className="mt-0.5 text-xs text-slate-500">{i.sub}</div>}
        </div>
      ))}
    </div>
  );
};

// Donut chart: slices = [{ label, value, color }]
export const Donut = ({ slices }) => {
  const total = slices.reduce((t, s) => t + s.value, 0);
  if (!total) return <p className="py-6 text-center text-sm text-slate-500">No orders in this period.</p>;
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <svg viewBox="0 0 140 140" className="h-40 w-40 shrink-0 -rotate-90" role="img" aria-label="Orders by status">
        {slices.filter((s) => s.value > 0).map((s) => {
          const len = (s.value / total) * c;
          const el = (
            <circle key={s.label} cx="70" cy="70" r={r} fill="none" stroke={s.color} strokeWidth="22"
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset}>
              <title>{`${s.label}: ${s.value}`}</title>
            </circle>
          );
          offset += len;
          return el;
        })}
        <text x="70" y="70" textAnchor="middle" dominantBaseline="middle" transform="rotate(90 70 70)" fontSize="22" fontWeight="700" fill="#0f172a">{total}</text>
      </svg>
      <ul className="w-full space-y-1.5 text-sm">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-slate-600"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{s.label}</span>
            <span className="font-semibold text-slate-900">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
