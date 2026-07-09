import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, ComposedChart,
} from "recharts";
import { IDS } from "@/constants/testIds";

function fmtTs(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function PowerTrendChart({ towerId, data, baseline, range, onRangeChange }) {
  const chart = useMemo(() => {
    if (!data || !data.points) return [];
    return data.points.map((p) => {
      const expected = baseline
        ? baseline.slope * (p.tr_load || 0) + baseline.intercept
        : null;
      return {
        ts: p.ts,
        label: fmtTs(p.ts),
        actual: p[data.metric],
        baseline: expected,
      };
    });
  }, [data, baseline]);

  const ranges = [
    { k: 6, label: "6h" },
    { k: 24, label: "24h" },
    { k: 72, label: "3d" },
    { k: 168, label: "7d" },
  ];

  return (
    <div className="scada-card p-4 h-full flex flex-col" data-testid={IDS.trendChart(towerId)}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="scada-label">Power vs Time</div>
          <div className="text-sm text-[#a1a6b4]">Actual (kW) vs commissioning-time baseline</div>
        </div>
        <div className="flex gap-1">
          {ranges.map((r) => (
            <button
              key={r.k}
              data-testid={IDS.trendRange(r.k)}
              onClick={() => onRangeChange(r.k)}
              className={`px-2 py-1 text-xs rounded-sm mono border ${
                range === r.k
                  ? "bg-[#0a84ff]/20 border-[#0a84ff]/40 text-[#0a84ff]"
                  : "bg-transparent border-[#2a2d35] text-[#a1a6b4] hover:border-[#3e4352]"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chart} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#2a2d35" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" stroke="#6b7280" tick={{ fill: "#a1a6b4", fontSize: 11 }} />
            <YAxis stroke="#6b7280" tick={{ fill: "#a1a6b4", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "#0b0d11", border: "1px solid #2a2d35", fontSize: 12 }}
              labelStyle={{ color: "#a1a6b4" }}
            />
            <Area
              type="monotone"
              dataKey="baseline"
              stroke="#0a84ff"
              strokeDasharray="4 4"
              strokeWidth={1}
              fill="#0a84ff"
              fillOpacity={0.08}
              name="Baseline"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="actual"
              stroke="#30d158"
              strokeWidth={1.5}
              dot={false}
              name="Actual"
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
