/* Minimal inline-SVG chart helpers, ported from the MMX reference's approach:
   compute a viewBox, draw gridlines/bars/paths as plain SVG strings-turned-JSX. */
import type { ReactNode } from "react";

export function Svg({ w, h, children }: { w: number; h: number; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ display: "block", overflow: "visible" }}>
      {children}
    </svg>
  );
}

export function BarChart({
  data,
  valueKey,
  labelKey,
  height = 220,
  formatValue = (v: number) => v.toFixed(1),
}: {
  data: Record<string, any>[];
  valueKey: string;
  labelKey: string;
  height?: number;
  formatValue?: (v: number) => string;
}) {
  const P = { l: 46, r: 12, t: 14, b: 30 };
  const W = Math.max(420, data.length * 90);
  const H = height;
  const max = Math.max(...data.map((d) => d[valueKey]), 1) * 1.15;
  const gw = (W - P.l - P.r) / data.length;
  const bw = gw * 0.5;
  const y = (v: number) => H - P.b - (v / max) * (H - P.t - P.b);

  const gridLines = [0, 1, 2, 3].map((i) => {
    const v = (max * i) / 3;
    const yy = y(v);
    return (
      <g key={i}>
        <line x1={P.l} x2={W - P.r} y1={yy} y2={yy} stroke="var(--line)" />
        <text x={P.l - 7} y={yy + 3.5} textAnchor="end" fontSize="9.5" fill="var(--ink-3)">
          {formatValue(v)}
        </text>
      </g>
    );
  });

  return (
    <div className="scroll">
      <Svg w={W} h={H}>
        {gridLines}
        {data.map((d, i) => {
          const cx = P.l + gw * i + gw / 2;
          const barY = y(d[valueKey]);
          return (
            <g key={i}>
              <rect x={cx - bw / 2} y={barY} width={bw} height={H - P.b - barY} fill="var(--accent-mid)" rx={1} />
              <text x={cx} y={barY - 6} textAnchor="middle" fontSize="10" fill="var(--ink-2)" fontWeight={500}>
                {formatValue(d[valueKey])}
              </text>
              <text x={cx} y={H - 12} textAnchor="middle" fontSize="10" fill="var(--ink-3)">
                {String(d[labelKey]).length > 11 ? String(d[labelKey]).slice(0, 10) + "…" : d[labelKey]}
              </text>
            </g>
          );
        })}
      </Svg>
    </div>
  );
}

export function CurveChart({
  points,
  currentSpend,
  currentRevenue,
  height = 200,
}: {
  points: { spend: number; revenue: number }[];
  currentSpend: number;
  currentRevenue: number;
  height?: number;
}) {
  const P = { l: 46, r: 14, t: 12, b: 26 };
  const W = 420;
  const H = height;
  const xMax = Math.max(...points.map((p) => p.spend), currentSpend, 1);
  const yMax = Math.max(...points.map((p) => p.revenue), currentRevenue, 1) * 1.1;
  const x = (v: number) => P.l + (v / xMax) * (W - P.l - P.r);
  const y = (v: number) => H - P.b - (v / yMax) * (H - P.t - P.b);

  const path =
    "M" +
    points.map((p) => `${x(p.spend)},${y(p.revenue)}`).join("L");

  const gridLines = [0, 1, 2, 3].map((i) => {
    const v = (yMax * i) / 3;
    const yy = y(v);
    return (
      <g key={i}>
        <line x1={P.l} x2={W - P.r} y1={yy} y2={yy} stroke="var(--line)" />
        <text x={P.l - 6} y={yy + 3.5} textAnchor="end" fontSize="9.5" fill="var(--ink-3)">
          {v.toFixed(0)}
        </text>
      </g>
    );
  });

  return (
    <Svg w={W} h={H}>
      {gridLines}
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2} />
      <circle cx={x(currentSpend)} cy={y(currentRevenue)} r={4.5} fill="var(--accent)" stroke="#fff" strokeWidth={1.5} />
      <text x={W / 2} y={H - 6} textAnchor="middle" fontSize="9.5" fill="var(--ink-3)">
        Spend £M
      </text>
    </Svg>
  );
}
