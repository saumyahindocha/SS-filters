import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { IDS } from "@/constants/testIds";
import { Waves, Clock } from "lucide-react";

const RADIAL_DOMAIN = [0, 100];
const RADIAL_BG = { fill: "#2a2d35" };

const CATEGORY_STYLE = {
  Clean: { color: "#30d158", bg: "bg-[#30d158]/10 text-[#30d158] border-[#30d158]/30" },
  Watch: { color: "#0a84ff", bg: "bg-[#0a84ff]/10 text-[#0a84ff] border-[#0a84ff]/30" },
  Fouled: { color: "#ff9f0a", bg: "bg-[#ff9f0a]/10 text-[#ff9f0a] border-[#ff9f0a]/30" },
  Critical: { color: "#ff3b30", bg: "bg-[#ff3b30]/10 text-[#ff3b30] border-[#ff3b30]/30" },
};

export default function FoulingPanel({ towerId, fouling }) {
  if (!fouling) {
    return (
      <div className="scada-card p-4 h-full">
        <div className="scada-label">Fouling Risk</div>
        <div className="mono text-2xl mt-2 text-[#6b7280]">—</div>
      </div>
    );
  }
  const pct = Math.round((fouling.fouling_index || 0) * 100);
  const cat = CATEGORY_STYLE[fouling.category] || CATEGORY_STYLE.Clean;
  const data = [{ name: "idx", value: pct, fill: cat.color }];
  return (
    <div className="scada-card p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <div className="scada-label">Fouling Risk</div>
        <Waves className="w-4 h-4 text-[#0a84ff]" />
      </div>
      <div className="grid grid-cols-2 gap-3 items-center">
        <div className="relative h-[160px]">
          <ResponsiveContainer>
            <RadialBarChart
              innerRadius="70%"
              outerRadius="100%"
              barSize={12}
              data={data}
              startAngle={220}
              endAngle={-40}
            >
              <PolarAngleAxis type="number" domain={RADIAL_DOMAIN} tick={false} />
              <RadialBar background={RADIAL_BG} dataKey="value" cornerRadius={0} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="mono text-3xl text-white font-bold tabular-nums">{pct}</div>
            <div className="scada-label">Index /100</div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div>
            <div className="scada-label">Category</div>
            <div
              data-testid={IDS.foulingCategory(towerId)}
              className={`inline-block mt-1 px-2 py-1 rounded-sm text-xs font-semibold uppercase tracking-wider border ${cat.bg}`}
            >
              {fouling.category}
            </div>
          </div>
          <div>
            <div className="scada-label flex items-center gap-1">
              <Clock className="w-3 h-3" /> Hours to Cleaning
            </div>
            <div
              data-testid={IDS.foulingHours(towerId)}
              className="mono text-xl text-white mt-1 tabular-nums"
            >
              {fouling.hours_to_cleaning != null ? fouling.hours_to_cleaning.toFixed(1) + " h" : "—"}
            </div>
          </div>
          <div className="text-[11px] text-[#6b7280] mt-1">
            Thresholds — watch {Math.round(fouling.thresholds.watch * 100)},
            fouled {Math.round(fouling.thresholds.fouled * 100)},
            critical {Math.round(fouling.thresholds.critical * 100)}
          </div>
        </div>
      </div>
    </div>
  );
}
